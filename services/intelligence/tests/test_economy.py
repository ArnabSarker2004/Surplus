from datetime import date
import pytest
from app.contracts import ForecastRequest
from app.economy import PriceContext
from app.engine import analyze
from test_forecasting import payload


def cpi_payload():
    data = payload()
    data["economy"] = dict(region="Ontario", status="live", fetchedAt="2026-09-18T12:00:00Z", series=[dict(key="all", label="All items", vector=1, points=[
        dict(period="2025-08-01", value=100, releasedAt="2025-09-15T08:30:00Z"),
        dict(period="2026-08-01", value=110, releasedAt="2026-09-15T08:30:00Z"),
        dict(period="2026-09-01", value=200, releasedAt="2026-10-15T08:30:00Z"),
    ])])
    return data


def test_cpi_does_not_leak_unpublished_future_release():
    context = PriceContext(ForecastRequest.model_validate(cpi_payload()))
    assert context.period == date(2026, 8, 1)
    assert context.rate("Groceries") == pytest.approx(.1)


def test_cpi_failure_and_stale_or_wrong_region_remain_usable_without_adjustment():
    for edit in ["unavailable", "stale", "region"]:
        data = cpi_payload()
        if edit == "unavailable":
            data["economy"]["series"] = []
        elif edit == "stale":
            data["asOf"] = "2027-09-18"
        else:
            data["economy"]["region"] = "Canada"
        result = analyze(ForecastRequest.model_validate(data))
        assert result["economy"]["status"] == "unavailable"
        assert result["economy"]["extraCost"] == 0


def test_price_growth_changes_variable_cost_but_not_fixed_bill_or_income():
    data = cpi_payload()
    result = analyze(ForecastRequest.model_validate(data))
    assert result["economy"]["extraCost"] > 0
    assert result["timeline"][-1]["constantPrices"] > result["timeline"][-1]["median"]
    assert result["economy"]["weightedAnnualRate"] == 10
    data["expenses"] = [dict(id="groceries", name="Entered groceries", amount=350, date="2026-09-20", category="Groceries", frequency="Monthly")]
    fixed = analyze(ForecastRequest.model_validate(data))
    assert fixed["economy"]["extraCost"] == 0
    assert fixed["summary"]["spendingNext30"] == 350
