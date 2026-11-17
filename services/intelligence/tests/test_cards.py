from datetime import timedelta
import pytest
from app.cards import compare_cards, estimate
from app.contracts import CardPreferences, ForecastRequest
from test_forecasting import NOW, payload, transaction


def comparison(**changes):
    return compare_cards(ForecastRequest.model_validate(payload(**changes)))


def test_shared_reward_caps_and_fees_are_applied():
    preferences = CardPreferences(recurringBills=True)
    bmo, _ = estimate("bmo", {"Groceries": 1000, "Bills": 800}, preferences)
    assert bmo["Groceries"] == pytest.approx(17.5)
    assert bmo["Bills"] == pytest.approx(6.5)
    simplii, _ = estimate("simplii", {"Dining": 1000, "Groceries": 1000, "Bills": 1000}, preferences)
    assert sum(simplii.values()) * 12 == pytest.approx(505)
    cobalt, _ = estimate("cobalt", {"Groceries": 2000, "Dining": 2000, "Transit": 100}, preferences)
    assert sum(cobalt.values()) == pytest.approx(142)
    result = comparison()
    card = next(c for c in result["cards"] if c["id"] == "cobalt")
    assert card["annualNet"] == pytest.approx(card["annualRewards"] - 191.88, abs=.01)
    assert card["annualPoints"] == pytest.approx(card["annualRewards"] * 100, abs=1)


def test_tangerine_optimizes_combined_categories_without_assuming_extra_account():
    monthly = {"Dining": 500, "Groceries": 400, "Transit": 200, "Bills": 1000}
    _, two = estimate("tangerine", monthly, CardPreferences())
    assert two == ["Dining", "Groceries"]
    _, three = estimate("tangerine", monthly, CardPreferences(tangerineSavings=True, recurringBills=True))
    assert three == ["Bills", "Dining", "Groceries"]


def test_refunds_reduce_rewards_and_ineligible_activity_does_not_inflate_them():
    baseline = payload(transactions=[transaction(str(i), NOW - timedelta(days=i)) for i in range(30)])
    original = compare_cards(ForecastRequest.model_validate(baseline))
    for ident, change in [
        ("rent", {"category": "Housing", "cashFlow": -5000}),
        ("tuition", {"category": "Tuition and School", "cashFlow": -5000}),
        ("transfer", {"classification": "Transfer", "cashFlow": -5000}),
        ("review", {"classification": "Review", "cashFlow": -5000}),
        ("pending", {"pending": True, "cashFlow": -5000}),
        ("foreign", {"currency": "USD", "cashFlow": -5000}),
        ("future", {"date": str(NOW + timedelta(days=1)), "cashFlow": -5000}),
        ("old", {"date": str(NOW - timedelta(days=100)), "cashFlow": -5000}),
    ]:
        row = transaction(ident, NOW)
        row.update(change)
        baseline["transactions"].append(row)
    excluded = compare_cards(ForecastRequest.model_validate(baseline))
    assert excluded["monthlyEligibleSpend"] == original["monthlyEligibleSpend"]
    baseline["transactions"].append(transaction("refund", NOW, cash=150))
    refunded = compare_cards(ForecastRequest.model_validate(baseline))
    assert refunded["monthlyEligibleSpend"] == pytest.approx(original["monthlyEligibleSpend"] / 2, abs=.01)


def test_no_ranked_recommendation_without_history_or_full_payment_confirmation():
    assert comparison()["recommendedId"] is None
    assert comparison(options={"cardPreferences": {"paidInFull": "no"}})["recommendedId"] is None
    short = comparison(transactions=[transaction("one", NOW)], options={"cardPreferences": {"paidInFull": "yes"}})
    assert short["recommendedId"] is None
    assert all(c["annualNet"] is None for c in short["cards"])
    assert comparison(transactions=[])["monthlyEligibleSpend"] == 0


def test_acceptance_assumption_reduces_amex_rewards_without_reducing_fee():
    full, _ = estimate("cobalt", {"Groceries": 200}, CardPreferences())
    half, _ = estimate("cobalt", {"Groceries": 200}, CardPreferences(amexAcceptancePercent=50))
    assert half["Groceries"] == full["Groceries"] / 2
    result = comparison(options={"cardPreferences": {"amexAcceptancePercent": 0}})
    assert next(c for c in result["cards"] if c["id"] == "cobalt")["annualNet"] == -191.88


def test_integrated_liquidity_gate_keeps_reward_math_but_withholds_recommendation():
    req = ForecastRequest.model_validate(payload(options={"cardPreferences": {"paidInFull": "yes"}}))
    good = {"status": "available", "horizons": [{"firstPressureDate": None}, {"firstPressureDate": None}]}
    baseline = compare_cards(req, good)
    assert baseline["recommendedId"] is not None
    for status, pressure in [("stale", None), ("insufficient", None), ("available", "2026-09-20")]:
        current = compare_cards(req, {"status": status, "horizons": [{"firstPressureDate": None}, {"firstPressureDate": pressure}]})
        assert current["recommendedId"] is None
        assert current["cards"] == baseline["cards"]
