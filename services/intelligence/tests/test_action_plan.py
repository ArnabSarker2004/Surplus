from datetime import timedelta
import pytest
from app.engine import analyze
from app.contracts import ForecastRequest
from app.behavior import analyze_behavior
from test_forecasting import NOW, payload, transaction


def report(**changes):
    return analyze(ForecastRequest.model_validate(payload(**changes)))


def test_split_receipt_counts_as_one_behavior_event():
    rows = [transaction(str(i), NOW-timedelta(days=i), -12, "Coffee", "Flexible") for i in range(1, 91)]
    baseline = analyze_behavior(ForecastRequest.model_validate(payload(transactions=rows)))
    split = [dict(t, id=t["id"]+suffix, eventId=t["id"], cashFlow=-6, category=category) for t in rows for suffix, category in [("a", "Coffee"), ("b", "Dining Out")]]
    result = analyze_behavior(ForecastRequest.model_validate(payload(transactions=split)))
    assert result["frequency"]["events"] == baseline["frequency"]["events"]
    assert result["frequency"]["days"] == baseline["frequency"]["days"]


def test_one_off_stays_in_actual_cash_but_not_future_spending_or_recurring():
    rows = [transaction(str(i), NOW - timedelta(days=i)) for i in range(120)]
    rows += [transaction("laptop", NOW-timedelta(days=7), -1500, "Shopping", "Discretionary", forecastTreatment="one_off")]
    r = report(transactions=rows)
    assert r["summary"]["startingUsableCash"] == 5000
    assert r["summary"]["spendingNext30"] == pytest.approx(300)
    assert any(c["category"] == "Shopping" and c["last30"] == 1500 for c in r["categories"])


def test_dated_income_change_has_exact_duration_and_no_random_reshuffle():
    base = report()
    event = dict(id="exam", name="Fewer shifts", start=str(NOW + timedelta(days=1)), end=str(NOW + timedelta(days=14)), weeklyIncomeChange=-70, weeklyExpenseChange=0)
    changed = report(lifeEvents=[event])
    assert changed["timeline"][14]["median"] == pytest.approx(base["timeline"][14]["median"] - 140)
    assert changed["timeline"][30]["median"] == pytest.approx(base["timeline"][30]["median"] - 140)
    assert changed["lifeEvents"][0]["name"] == "Fewer shifts"


def test_weekly_plan_has_dates_and_no_double_counted_payments():
    r = report(expenses=[dict(id="bill", name="Phone", amount=25, date=str(NOW+timedelta(days=3)), category="Phone and Internet", frequency="Once")])
    p = r["weeklyPlan"]
    assert p["scheduledBills"] == 25
    assert p["variableSpending"] == pytest.approx(70)
    assert len(p["actions"]) <= 3
    assert p["upcoming"][0]["label"] == "Phone"


def test_only_actionable_review_flags_raise_categorization_prompts():
    reviewed = transaction("other", NOW - timedelta(days=2), -20, "Other", "Review", categoryOrigin="user", reviewRequired=False)
    result = report(transactions=[reviewed])
    assert not any("category" in w or "categorization" in w for w in result["quality"]["warnings"])
    assert not any(a["page"] == "review" for a in result["weeklyPlan"]["actions"])
    unresolved = dict(reviewed, categoryOrigin="review", reviewRequired=True)
    result = report(transactions=[unresolved])
    assert "1 transaction needs a category or corrected split." in result["quality"]["warnings"]
    assert any(a["page"] == "review" for a in result["weeklyPlan"]["actions"])
    for excluded in [dict(unresolved, pending=True), dict(unresolved, currency="USD"), dict(unresolved, date=str(NOW + timedelta(days=2)))]:
        result = report(transactions=[excluded])
        assert not any("corrected split" in w for w in result["quality"]["warnings"])


def test_account_assignments_reveal_pressure_hidden_by_combined_cash():
    r = report(accounts=[dict(id="cash", type="depository", balance=40, currency="CAD", source="live"), dict(id="savings", type="depository", balance=5000, currency="CAD", source="live")],
               expenses=[dict(id="bill", name="Rent", amount=100, date=str(NOW+timedelta(days=1)), category="Housing", frequency="Once", accountId="cash")])
    assert r["summary"]["endingMedian"] > 0
    accounts = r["accountOutlooks"]["accounts"]
    assert accounts[0]["firstNegativeDate"] == str(NOW + timedelta(days=1))
    assert accounts[1]["firstNegativeDate"] is None
    assert accounts[1]["ending"] == 5000


def test_unassigned_payments_with_multiple_accounts_are_explicit():
    r = report(accounts=[dict(id="a", type="depository", balance=100, currency="CAD", source="live"), dict(id="b", type="depository", balance=100, currency="CAD", source="live")],
               expenses=[dict(id="bill", name="Phone", amount=25, date=str(NOW+timedelta(days=3)), category="Phone and Internet", frequency="Once")])
    assert all(a["unassignedPayments"] == 1 and a["status"] == "partial" for a in r["accountOutlooks"]["accounts"])
