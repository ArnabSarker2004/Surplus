from datetime import timedelta
import pytest
from pydantic import ValidationError
from app.contracts import ForecastRequest
from test_forecasting import NOW, payload, report, transaction


def wages():
    return [transaction(f"pay-{i}", NOW - timedelta(days=14 * i), cash=750,
                        category="Employment Income", classification="Income") for i in range(10)]


def job(**changes):
    fields = dict(id="coop", name="Co-op", amount=1200, date="2026-09-25", endDate="2026-10-09",
                  type="Earned", status="Expected", frequency="Biweekly", workKind="Co-op",
                  workStart="2026-09-01", workEnd="2026-10-02")
    fields.update(changes)
    return fields


def test_job_ends_and_final_pay_can_follow_last_work_day():
    result = report(transactions=wages(), funding=[job()])
    income = [e for e in result["upcoming"] if e["direction"] == "income"]
    assert [(e["date"], e["amount"]) for e in income] == [("2026-09-25", 1200), ("2026-10-09", 1200)]
    assert result["summary"]["incomeNext30"] == 2400
    student = result["student"]
    assert student["jobs"][0]["lastPayday"] == "2026-10-09"
    assert student["scheduledEarnings"] == 2400
    assert all(p["median"] == 7400 for p in result["timeline"] if p["date"] > "2026-10-09")


@pytest.mark.parametrize("status", ["Expected", "Confirmed", "Received"])
def test_already_ended_jobs_never_restart_from_history(status):
    result = report(transactions=wages(), funding=[job(date="2026-09-01", endDate="2026-09-15", workEnd="2026-09-15", status=status)])
    assert result["student"]["incomeBasis"] == "schedule"
    assert result["summary"]["incomeNext30"] == 0
    assert result["summary"]["endingMedian"] == 5000
    assert result["student"]["gaps"][0]["days"] == 90


def test_future_coop_after_horizon_does_not_repeat_old_wages():
    result = report(transactions=wages(), funding=[job(date="2027-01-15", endDate="2027-04-23", workStart="2027-01-04", workEnd="2027-04-16")])
    assert result["summary"]["incomeNext30"] == 0
    assert result["student"]["scheduledEarnings"] == 0


def test_confirmed_no_work_suppresses_wages_but_preserves_other_funding():
    grant = dict(id="grant", name="Grant", amount=3000, date="2026-10-01", type="Non-repayable", status="Confirmed", frequency="Once")
    result = report(transactions=wages(), workScheduleConfirmed=True, funding=[grant])
    assert result["summary"]["incomeNext30"] == 3000
    assert result["student"]["scheduledEarnings"] == 0
    assert result["student"]["gaps"][0]["cashNeeded"] == 0


def test_concurrent_jobs_and_gaps_and_monthly_totals():
    result = report(transactions=[], funding=[job(), job(id="campus", name="Campus job", amount=200, date="2026-10-02", endDate="2026-10-23", frequency="Weekly")])
    assert result["student"]["scheduledEarnings"] == 3200
    gaps = result["student"]["gaps"]
    assert [(g["start"], g["end"]) for g in gaps] == [("2026-09-19", "2026-09-24"), ("2026-10-24", "2026-12-17")]
    assert sum(m["income"] for m in result["student"]["months"]) == 3200


def test_next_job_resumes_only_on_first_payday():
    result = report(transactions=wages(), funding=[job(), job(id="next", date="2026-11-06", endDate="2026-12-04", workStart="2026-10-26", workEnd="2026-11-27")])
    gaps = result["student"]["gaps"]
    assert any(g["start"] == "2026-10-10" and g["end"] == "2026-11-05" for g in gaps)
    assert result["student"]["scheduledEarnings"] == 6000


def test_gap_begins_after_last_actual_payday_when_cutoff_is_between_paydays():
    result = report(transactions=[], funding=[job(endDate="2026-10-12")])
    assert result["student"]["jobs"][0]["lastPayday"] == "2026-10-09"
    assert result["student"]["gaps"][-1]["start"] == "2026-10-10"


def test_gap_cost_and_term_balance_include_tuition_and_reserves():
    result = report(workScheduleConfirmed=True, semester=dict(name="Fall", start="2026-09-01", end="2026-10-18"),
                    expenses=[dict(id="tuition", name="Tuition", amount=3000, date="2026-10-01", category="Tuition and School", frequency="Once")])
    assert result["student"]["gaps"][0]["cashNeeded"] == pytest.approx(3900)
    assert result["student"]["semester"]["balance"] == pytest.approx(1700)
    assert result["student"]["semester"]["afterReserves"] == pytest.approx(1600)
    assert sum(m["spending"] for m in result["student"]["months"]) == pytest.approx(3900)


def test_unknown_cash_and_term_beyond_horizon_stay_unknown():
    result = report(accounts=[], semester=dict(name="Fall", start="2026-09-01", end="2026-12-31"), workScheduleConfirmed=True)
    assert result["student"]["semester"]["balance"] is None
    assert result["student"]["semester"]["inHorizon"] is False
    assert result["student"]["gaps"][0]["endingCash"] is None


def test_pay_schedule_validation_and_legacy_history():
    with pytest.raises(ValidationError):
        ForecastRequest.model_validate(payload(funding=[job(endDate="2026-09-01")]))
    with pytest.raises(ValidationError):
        ForecastRequest.model_validate(payload(funding=[job(workEnd="2026-08-01")]))
    result = report(transactions=wages())
    assert result["student"]["incomeBasis"] == "history"
    assert result["summary"]["incomeNext30"] > 0


def test_applied_job_does_not_add_expected_pay():
    result = report(transactions=wages(), workScheduleConfirmed=True, funding=[job(status="Applied")])
    assert result["summary"]["incomeNext30"] == 0
    assert result["student"]["jobs"] == []
