"""Student planning summaries derived from the same daily cash paths as the forecast."""
from datetime import timedelta
import numpy as np
from .calendar import occurrences


def uses_work_schedule(request):
    # An ended job is still evidence: never resurrect its wages from bank history.
    return request.workScheduleConfirmed or any(
        f.type == "Earned" and (f.status in ("Expected", "Confirmed") or
                                (f.status == "Received" and f.endDate is not None))
        for f in request.funding
    )


def student_outlook(request, dates, balances, daily_spend, daily_income,
                    scheduled_expenses, scheduled_income, known_cash, buffer):
    now, end = dates[0], dates[-1]
    median = np.median(balances, axis=0)
    scheduled = uses_work_schedule(request)
    jobs, covered = [], set()
    for f in request.funding:
        if f.type != "Earned" or f.status == "Applied":
            continue
        until = min(end, f.endDate or end)
        paydays = occurrences(f.date, f.frequency, now + timedelta(days=1), until) if f.status != "Received" else []
        all_paydays = occurrences(f.date, f.frequency, max(f.date, f.endDate - timedelta(days=32)), f.endDate) if f.endDate else []
        coverage_end = min(end, all_paydays[-1]) if all_paydays else until
        if f.status in ("Expected", "Confirmed") and f.amount > 0:
            for d in dates[1:]:
                if f.date <= d <= (f.date if f.frequency == "Once" else coverage_end):
                    covered.add(d)
        jobs.append({"id": f.id, "name": f.name, "kind": f.workKind or "Job",
                     "start": str(f.workStart or f.date), "end": str(f.workEnd or f.endDate) if f.workEnd or f.endDate else None,
                     "firstPayday": str(f.date), "lastPayday": str(all_paydays[-1]) if all_paydays else str(f.date) if f.frequency == "Once" else None,
                     "nextPayday": str(paydays[0]) if paydays else None,
                     "remainingPay": round(f.amount * len(paydays), 2), "paydaysLeft": len(paydays),
                     "amount": f.amount, "frequency": f.frequency, "status": f.status})
    gaps = []
    if scheduled:
        i = 1
        while i < len(dates):
            if dates[i] in covered:
                i += 1
                continue
            first = i
            while i < len(dates) and dates[i] not in covered:
                i += 1
            last = i - 1
            spending = float(np.median(daily_spend[:, first - 1:last].sum(axis=1))) + float(scheduled_expenses[first:last + 1].sum())
            # Grants, loans and dated adjustments still fund a period without job pay.
            income = float(np.median(daily_income[:, first - 1:last].sum(axis=1))) + float(scheduled_income[first:last + 1].sum())
            pressure = next((str(dates[j]) for j in range(first, last + 1) if median[j] < buffer), None) if known_cash else None
            gaps.append({"start": str(dates[first]), "end": str(dates[last]), "days": last - first + 1,
                         "cashNeeded": round(max(0, spending - income), 2),
                         "endingCash": round(float(median[last]), 2) if known_cash else None,
                         "firstPressureDate": pressure})
    months = []
    for month in dict.fromkeys(str(d)[:7] for d in dates[1:]):
        indices = [i for i, d in enumerate(dates) if i > 0 and str(d).startswith(month)]
        first, last = indices[0], indices[-1]
        months.append({"month": month, "start": str(dates[first]), "end": str(dates[last]),
                       "income": round(float(np.median(daily_income[:, first - 1:last].sum(axis=1))) + float(scheduled_income[first:last + 1].sum()), 2),
                       "spending": round(float(np.median(daily_spend[:, first - 1:last].sum(axis=1))) + float(scheduled_expenses[first:last + 1].sum()), 2),
                       "endingCash": round(float(median[last]), 2) if known_cash else None})
    term = request.semester
    term_index = (term.end - now).days if term else -1
    term_known = known_cash and 0 <= term_index < len(dates)
    return {"incomeBasis": "schedule" if scheduled else "history", "jobs": jobs, "gaps": gaps,
            "months": months, "scheduledEarnings": round(sum(j["remainingPay"] for j in jobs), 2),
            "semester": {"name": term.name, "end": str(term.end),
                         "balance": round(float(median[term_index]), 2) if term_known else None,
                         "afterReserves": round(float(median[term_index] - buffer), 2) if term_known else None,
                         "inHorizon": 0 <= term_index < len(dates)} if term else None}
