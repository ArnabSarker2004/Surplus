from datetime import timedelta
import numpy as np
import pytest
from app.behavior import analyze_behavior
from app.contracts import ForecastRequest, HabitAdjustment
from app.engine import analyze
from app.liquidity import liquidity_report
from app.patterns import recurring_streams
from test_forecasting import NOW, payload, transaction


def request_with(rows, **changes):
    return ForecastRequest.model_validate(payload(transactions=rows, **changes))


def test_merchant_entities_join_bank_aliases_but_unknown_processors_stay_separate():
    rows = [{**transaction(f"bill-{i}", NOW - timedelta(days=i * 30), -20, "Subscriptions", "Flexible",
                          merchantKey="entity:one-company"), "merchant": f"BANK ALIAS {i}"} for i in range(3)]
    req = request_with(rows)
    streams = recurring_streams(req.transactions, NOW, NOW + timedelta(days=90))
    assert len(streams) == 1 and streams[0]["observations"] == 3
    for row in rows:
        row.update(merchant="PayPal", merchantKey=f"unresolved:{row['id']}")
    assert not recurring_streams(request_with(rows).transactions, NOW, NOW + timedelta(days=90))


def test_detailed_spending_nets_refunds_and_excludes_pending_foreign_transfers_and_unknown_income():
    base = transaction("coffee", NOW, -12, "Coffee", "Flexible", detailLabel="Coffee", detailCategory="FOOD_AND_DRINK_COFFEE")
    rows = [base, {**base, "id": "refund", "cashFlow": 3},
            {**base, "id": "pending", "pending": True}, {**base, "id": "foreign", "currency": "USD"},
            {**base, "id": "transfer", "classification": "Transfer"}, {**base, "id": "review", "classification": "Review"}]
    assert analyze_behavior(request_with(rows))["detailSpending"] == [{"category": "Coffee", "detail": "Coffee", "amount": 9, "purchases": 1}]


def rhythm():
    rows = [transaction(f"g-{i}", NOW - timedelta(days=i)) for i in range(120)]
    for i in range(1, 119):
        day = NOW - timedelta(days=i)
        if day.weekday() == 4:
            for n in range(4):
                rows.append(transaction(f"coffee-{i}-{n}", day, -8, "Coffee", "Flexible"))
    return rows


def test_frequency_models_counts_excludes_groceries_and_validates_future_holdout():
    b = analyze_behavior(request_with(rhythm()))
    assert b["frequency"]["method"] == "Weekday Poisson regression"
    assert b["frequency"]["validation"]["weekdayDeviance"] < b["frequency"]["validation"]["baselineDeviance"] * .95
    assert b["frequency"]["days"][4]["observed"] == 4
    assert b["frequency"]["days"][0]["observed"] == 0
    assert b["coverage"]["timestamped"] == 0
    assert not b["sequences"] and not b["windows"]


def test_future_pending_transfer_foreign_and_routine_never_become_optional_events():
    baseline = rhythm()
    initial = analyze_behavior(request_with(baseline))["frequency"]
    for n, fields in enumerate([{"date": str(NOW + timedelta(days=1))}, {"pending": True},
                                {"classification": "Transfer"}, {"currency": "USD"},
                                {"habitTreatment": "routine"}, {"classification": "Review"}]):
        item = transaction(f"excluded-{n}", NOW - timedelta(days=10), -9999, "Coffee", "Flexible")
        item.update(fields)
        baseline.append(item)
    assert analyze_behavior(request_with(baseline))["frequency"] == initial


def test_sparse_counts_do_not_claim_a_validated_model():
    result = analyze_behavior(request_with([transaction("one", NOW, -15, "Coffee", "Flexible")]))
    assert result["frequency"]["method"] == "Smoothed weekday counts"
    assert result["frequency"]["validation"] is None
    assert result["payday"]["status"] == "insufficient"
    assert analyze_behavior(request_with([]))["frequency"]["events"] == 0


def test_sequences_require_real_aware_authorization_times_and_distinct_days():
    rows = rhythm()
    for n in [7, 14, 21]:
        day = NOW - timedelta(days=n)
        rows += [transaction(f"a-{n}", day, -12, "Coffee", "Flexible", authorizedAt=f"{day}T16:00:00-04:00"),
                 transaction(f"b-{n}", day, -30, "Shopping", "Discretionary", authorizedAt=f"{day}T17:20:00-04:00")]
    result = analyze_behavior(request_with(rows))
    assert result["coverage"]["timestamped"] == 6
    assert result["sequences"] == [{"from": "Coffee", "to": "Shopping", "occurrences": 3, "distinctDays": 3}]
    assert result["windows"][0]["startHour"] == 15
    for t in rows:
        if t.get("authorizedAt"):
            t["authorizedAt"] = t["authorizedAt"][:-6]  # no timezone: unusable
    assert not analyze_behavior(request_with(rows))["sequences"]


def test_timestamp_timezone_and_online_location_exclusions():
    rows = rhythm()
    for n in [7, 14, 21]:
        day = NOW - timedelta(days=n)  # Friday UTC becomes Thursday evening in Toronto.
        rows.append(transaction(f"utc-{n}", day, -15, "Coffee", "Flexible", authorizedAt=f"{day}T00:30:00Z",
                                location={"city": "Toronto", "region": "ON", "country": "CA"}, paymentChannel="online"))
    result = analyze_behavior(request_with(rows))
    assert result["windows"][0]["day"] == "Thursday"
    assert result["windows"][0]["startHour"] == 18
    assert not result["locations"]
    for t in rows:
        if t.get("location"):
            t["paymentChannel"] = "in store"
    assert analyze_behavior(request_with(rows))["locations"][0]["visits"] == 3


def test_payday_comparison_matches_weekdays_and_excludes_planned_purchases():
    rows = [transaction(f"history-{i}", NOW - timedelta(days=i)) for i in range(180)]
    for i in range(10, 170, 14):
        day = NOW - timedelta(days=i)
        rows.append(transaction(f"pay-{i}", day, 500, "Employment Income", "Income"))
        rows.append(transaction(f"meal-{i}", day, -30, "Eating Out", "Flexible"))
        rows.append(transaction(f"control-{i}", day - timedelta(days=7), -15, "Eating Out", "Flexible"))
        rows.append(transaction(f"planned-{i}", day, -500, "Shopping", "Discretionary", habitTreatment="routine"))
    pay = analyze_behavior(request_with(rows))["payday"]
    assert pay["status"] == "observed" and pay["cycles"] >= 4
    assert pay["after"] == 10 and pay["comparison"] == 5 and pay["changePercent"] == 100


def test_subscription_increase_needs_sustained_cadence_and_six_observations():
    rows = [transaction(f"bill-{i}", NOW - timedelta(days=(6-i)*30), -10 if i < 3 else -15, "Subscriptions", "Flexible") for i in range(6)]
    charges = analyze_behavior(request_with(rows))["risingCharges"]
    assert len(charges) == 1 and charges[0]["annualExtra"] == 60
    assert charges[0]["correlation"] > .5
    assert not analyze_behavior(request_with(rows[:5]))["risingCharges"]


def test_repeat_merchant_trend_is_ticket_size_not_cpi():
    rows = [transaction(f"ticket-{i}", NOW - timedelta(days=i*20), -20 if i < 5 else -10) for i in range(9)]
    trend = analyze_behavior(request_with(rows))["ticketTrends"][0]
    assert trend["before"] == 10 and trend["after"] == 20
    assert "inflation" not in trend


def test_liquidity_observes_known_bill_before_income_and_protects_goals():
    req = request_with([], options={"horizonDays": 30}, goals=[dict(id="g", name="School", target=200, current=50, date=str(NOW+timedelta(days=20)), priority="High")])
    dates = [NOW + timedelta(days=i) for i in range(31)]
    balances = np.full((400, 31), 500.)
    balances[:, 4:8] = 20
    report = liquidity_report(req, dates, balances, 150, True, True, [], [])
    assert report["horizons"][0]["bufferBreachShare"] == 100
    assert report["horizons"][0]["negativeShare"] == 0
    assert report["horizons"][0]["firstPressureDate"] == str(dates[4])
    assert report["safeToSetAside"] == 0
    balances[:] = 500
    assert liquidity_report(req, dates, balances, 150, True, True, [], [])["safeToSetAside"] == 200
    req.syncedAt = "2026-08-01T12:00:00Z"
    assert liquidity_report(req, dates, balances, 150, True, True, [], [])["safeToSetAside"] is None


def test_metadata_and_habit_labels_do_not_reshuffle_cash_simulations():
    rows = rhythm()
    first = analyze(request_with(rows))
    for row in rows:
        row.update(habitTreatment="routine", location={"city": "Toronto"}, merchant="Clean company name",
                   merchantKey="entity:confirmed", merchantSource="user", merchantConfidence="USER",
                   detailLabel="Confirmed detail", detailCategory="confirmed", categoryOrigin="user")
    after = analyze(request_with(rows))
    assert first["timeline"] == after["timeline"]
    assert after["behavior"]["frequency"]["events"] == 0
    assert after["habits"]["patterns"] == []


def test_habit_scenario_moves_goal_path_without_changing_baseline():
    rows = rhythm()
    base = request_with(rows, goals=[dict(id="g", name="School", target=4500, current=0, date=str(NOW+timedelta(days=90)), priority="High")])
    before = analyze(base)
    base.options.habitAdjustment = HabitAdjustment(weekday=4, category="Coffee", reductionPercent=25)
    # Revalidate assignment, as production payload validation does.
    base = ForecastRequest.model_validate(base.model_dump())
    after = analyze(base)
    assert [p["median"] for p in before["timeline"]] == [p["median"] for p in after["timeline"]]
    assert after["habits"]["interventionMonthlySavings"] > 0
    assert after["goals"][0]["scenarioAmount"] >= after["goals"][0]["projectedAmount"]
