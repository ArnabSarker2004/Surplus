from datetime import date, timedelta
import os
os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")
import numpy as np
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from app.contracts import ForecastRequest
from app.engine import analyze
from app.models import forecast_series, fit_predict
from app.calendar import occurrences
from app.main import app

NOW = date(2026, 9, 18)


def transaction(ident, when, cash=-10, category="Groceries", classification="Essential", **extra):
    return dict(id=ident, accountId="cash", date=str(when), merchant="Store", cashFlow=cash,
                category=category, classification=classification, currency="CAD", pending=False, source="live", **extra)


def payload(**changes):
    result = dict(asOf=str(NOW), source="live", syncedAt="2026-09-18T12:00:00Z", minimumBalance=100,
                  transactions=[transaction(str(i), NOW - timedelta(days=i)) for i in range(120)],
                  accounts=[dict(id="cash", type="depository", balance=5000, currency="CAD", source="live")],
                  expenses=[], funding=[], goals=[], options=dict(horizonDays=90))
    result.update(changes)
    return result


def report(**changes):
    return analyze(ForecastRequest.model_validate(payload(**changes)))


def test_cash_forecast_and_ranges_are_ordered_and_reproducible():
    a = report()
    assert a == report()
    assert a["summary"]["spendingNext30"] == pytest.approx(300)
    assert a["summary"]["endingMedian"] == pytest.approx(4100)
    assert all(p["low"] <= p["median"] <= p["high"] for p in a["timeline"])


def test_personal_savings_exclude_unreviewed_loan_and_education_money_without_changing_cash_paths():
    base = report()
    protected = report(savingsEligibleCash=0)
    assert protected["timeline"] == base["timeline"]
    assert protected["liquidity"]["safeToSetAside"] == 0
    assert protected["summary"]["safeWeeklyRoom"] == 0
    owned = report(savingsEligibleCash=5000)
    assert owned["liquidity"]["safeToSetAside"] == base["liquidity"]["safeToSetAside"]


@pytest.mark.parametrize("kind", ["Repayable", "Non-repayable"])
def test_future_school_funding_covers_bills_but_cannot_create_personal_savings(kind):
    future = dict(id="fund", name="OSAP", amount=10000, date=str(NOW + timedelta(days=1)),
                  frequency="Once", type=kind, status="Confirmed")
    result = report(savingsEligibleCash=0, funding=[future],
                    goals=[dict(id="goal", name="Personal savings", target=1000, current=0,
                                date=str(NOW + timedelta(days=60)), priority="High")])
    assert result["timeline"][-1]["median"] > 10000
    assert result["liquidity"]["safeToSetAside"] == 0
    assert result["goals"][0]["projectedAmount"] == 0


def test_what_if_changes_do_not_change_the_baseline_or_early_horizon_paths():
    base = payload()
    for i, transaction in enumerate(base["transactions"]):
        transaction["cashFlow"] = -(10 + i % 9)
    initial = analyze(ForecastRequest.model_validate(base))
    base["options"] = {"horizonDays": 180, "monthlyExtraIncome": 500, "flexibleReductionPercent": 20}
    changed = analyze(ForecastRequest.model_validate(base))
    assert [p["median"] for p in initial["timeline"]] == [p["median"] for p in changed["timeline"][:91]]
    assert initial["summary"]["netNext30"] == changed["summary"]["netNext30"]


def test_transfers_foreign_pending_future_and_unknown_deposits_do_not_train_as_income():
    baseline = payload()
    for ident, fields in [("transfer", {"cashFlow": 10000, "classification": "Transfer"}),
                          ("foreign", {"cashFlow": 9999, "currency": "USD"}),
                          ("pending", {"cashFlow": 8888, "pending": True}),
                          ("future", {"cashFlow": 7777, "date": str(NOW + timedelta(days=1))}),
                          ("unknown", {"cashFlow": 6666, "classification": "Review", "category": "Other"})]:
        entry = transaction(ident, NOW)
        entry.update(fields)
        baseline["transactions"].append(entry)
    result = analyze(ForecastRequest.model_validate(baseline))
    assert result["summary"]["incomeNext30"] == 0
    assert result["summary"]["spendingNext30"] == pytest.approx(300)


def test_credit_and_pending_are_reserved_but_never_counted_as_cash():
    base = payload()
    base["accounts"] += [dict(id="credit", type="credit", balance=1000, currency="CAD", source="live"), dict(id="investment", type="investment", balance=100000, currency="CAD", source="live")]
    pending = transaction("pending", NOW, cash=-50)
    pending["pending"] = True
    base["transactions"].append(pending)
    result = analyze(ForecastRequest.model_validate(base))
    assert result["summary"]["cash"] == 5000
    assert result["summary"]["startingUsableCash"] == 3950
    assert result["summary"]["spendingNext30"] == pytest.approx(300)


def test_partial_or_missing_history_does_not_claim_measured_accuracy():
    result = report(transactions=[transaction("one", NOW - timedelta(days=1), cash=-20)])
    assert result["quality"]["level"] == "limited"
    assert result["models"][0]["mae"] is None
    assert result["models"][0]["trainingWeeks"] == 0
    assert result["summary"]["bufferBreachRate"] is None
    assert result["summary"]["spendingNext30"] > 0
    empty = report(transactions=[], accounts=[])
    assert empty["summary"]["endingMedian"] is None
    assert all(point["median"] is None for point in empty["timeline"])
    assert report(transactions=[], accounts=[], options={"openingCash": 1000})["summary"]["cash"] == 1000


def test_manual_monthly_expense_replaces_category_model_not_double_counts():
    result = report(expenses=[dict(id="groceries", name="Groceries", amount=600, date="2026-09-25", category="Groceries", frequency="Monthly")])
    assert result["summary"]["spendingNext30"] == 600


@pytest.mark.parametrize("category", ["Grants and Bursaries", "OSAP Funding", "RESP Funding", "Student Aid Funding"])
def test_historical_grants_and_received_funding_do_not_repeat(category):
    base = payload()
    base["transactions"].append(transaction("grant", NOW - timedelta(days=5), cash=9000, category=category, classification="Income"))
    base["funding"] = [dict(id="received", name="Already received", amount=3000, date="2026-10-01", type="Non-repayable", status="Received", frequency="Once"), dict(id="applied", name="Pending grant", amount=5000, date="2026-10-01", type="Non-repayable", status="Applied", frequency="Once")]
    assert analyze(ForecastRequest.model_validate(base))["summary"]["incomeNext30"] == 0


def test_detected_pay_and_entered_pay_are_not_double_counted():
    transactions = [transaction(str(i), NOW - timedelta(days=14 * i), cash=500, category="Employment Income", classification="Income") for i in range(10)]
    result = report(transactions=transactions, funding=[dict(id="pay", name="Job pay", amount=1000, date="2026-09-25", endDate="2026-10-10", type="Earned", status="Expected", frequency="Biweekly")])
    assert result["summary"]["incomeNext30"] == 2000
    assert result["recurring"][0]["included"] is False
    assert result["models"][1]["selected"] == "Recent average"


def test_tuition_gap_and_extra_earnings_scenario():
    result = report(expenses=[dict(id="tuition", name="Fall tuition", amount=6000, date="2026-10-18", category="Tuition and School", frequency="Once")], options={"horizonDays": 90, "monthlyExtraIncome": 2500})
    bill = result["tuition"][0]
    assert bill["gapAtDeadline"] == 1400  # 5000 - 300 spending - 6000 bill - 100 buffer.
    assert bill["successRate"] == 0
    assert bill["scenarioSuccessRate"] == 100
    assert bill["extraPerWeek"] > 0
    assert result["summary"]["scenarioEndingMedian"] > result["summary"]["endingMedian"]


def test_goal_priorities_cannot_spend_the_same_cash_twice():
    result = report(transactions=[], accounts=[dict(id="cash", type="depository", balance=1100, currency="CAD", source="live")], goals=[dict(id="first", name="High priority", target=800, current=0, date="2026-10-18", priority="High"), dict(id="second", name="Lower priority", target=800, current=0, date="2026-10-18", priority="Low")])
    assert result["goals"][0]["projectedAmount"] == 800
    assert result["goals"][1]["projectedAmount"] == 200
    assert result["goals"][1]["projectedDate"] is None


def test_goal_savings_are_earmarked_cash_not_new_income():
    result = report(transactions=[], goals=[dict(id="goal", name="Savings", target=6000, current=3000, date="2026-10-18", priority="High")])
    assert result["summary"]["cash"] == 5000
    assert result["summary"]["goalReserve"] == 3000
    assert result["goals"][0]["projectedAmount"] == 4900


def test_month_end_and_outside_horizon_deadlines():
    assert occurrences(date(2026, 1, 31), "Monthly", date(2026, 2, 1), date(2026, 3, 31)) == [date(2026, 2, 28), date(2026, 3, 31)]
    result = report(expenses=[dict(id="tuition", name="Next year", amount=5000, date="2027-09-01", category="Tuition and School", frequency="Once")])
    assert result["tuition"][0]["successRate"] is None
    assert result["tuition"][0]["status"] == "beyond_horizon"


def test_stopped_recurring_payment_not_assumed_to_continue():
    old = [transaction(str(i), NOW - timedelta(days=200 + 30 * i), cash=-50, category="Subscriptions") for i in range(4)]
    assert report(transactions=old)["recurring"] == []


def test_models_evaluate_only_future_holdouts_and_can_learn():
    values = np.array([100 + i * 8 + (i % 4) * 3 for i in range(50)])
    learned = forecast_series(values, 6, "Test")
    assert learned.report["validationWeeks"] == 8
    assert learned.report["selected"] == "Ridge regression"
    scores = {row["name"]: row["mae"] for row in learned.report["candidates"]}
    assert scores["Ridge regression"] < scores["Recent average"]
    original = fit_predict(values[:30], 2, "Ridge regression")
    values[30:] = 1_000_000
    np.testing.assert_array_equal(original, fit_predict(values[:30], 2, "Ridge regression"))


def test_models_handle_zero_activity_without_nan():
    result = forecast_series(np.zeros(40), 10, "Zero")
    assert np.all(result.predictions == 0)
    assert result.report["selected"] == "Recent average"
    assert result.report["mae"] == 0


def test_mixed_sources_duplicate_ids_and_invalid_numbers_rejected():
    base = payload()
    base["transactions"][0]["source"] = "demo"
    with pytest.raises(ValidationError):
        ForecastRequest.model_validate(base)
    base = payload()
    base["transactions"].append(base["transactions"][0])
    with pytest.raises(ValidationError):
        ForecastRequest.model_validate(base)
    with pytest.raises(ValidationError):
        ForecastRequest.model_validate(payload(options={"openingCash": float("nan")}))


def test_service_requires_internal_auth_and_never_echoes_invalid_financial_payload(monkeypatch):
    monkeypatch.setenv("INTELLIGENCE_SERVICE_TOKEN", "test-service-token-" * 3)
    client = TestClient(app)
    assert client.post("/v1/forecast", json=payload()).status_code == 401
    headers = {"Authorization": "Bearer " + "test-service-token-" * 3}
    bad = payload(secret="must-not-appear")
    response = client.post("/v1/forecast", json=bad, headers=headers)
    assert response.status_code == 422
    assert "must-not-appear" not in response.text
    response = client.post("/v1/forecast", json=payload(), headers=headers)
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    assert len(response.json()["assistant"]) == 5
