"""Short, evidenced next steps and account-level known-payment projections."""
from datetime import timedelta
import numpy as np


def action_plan(request, ledger, liquidity, daily_spend, scheduled_expenses, scheduled_income, known_cash, transactions):
    now = request.asOf
    end = now + timedelta(days=7)
    upcoming = [e for e in sorted(ledger, key=lambda e: (e["date"], e["label"])) if str(now) < e["date"] <= str(end)]
    review = sum(t.reviewRequired for t in transactions)
    pressure = liquidity["horizons"][0]["firstPressureDate"]
    actions = []
    if liquidity["status"] == "stale" or not known_cash:
        actions.append({"id": "freshness", "title": "Check your bank snapshot", "detail": "Sync your accounts before relying on spending room.", "page": "sync", "priority": "high"})
    if pressure:
        actions.append({"id": f"buffer-{pressure}", "title": "Protect this week's buffer", "detail": f"The median cash path crosses your protected balance on {pressure}. Review bills and incoming pay.", "page": "semester", "priority": "high"})
    if review:
        actions.append({"id": f"review-{now}", "title": f"Review {review} uncertain entries", "detail": "Confirm income, transfers and spending before they shape your forecast.", "page": "review", "priority": "normal"})
    bill = next((e for e in upcoming if e["direction"] == "expense"), None)
    if bill:
        actions.append({"id": f"bill-{bill['date']}-{bill['label'][:80]}", "title": f"Prepare for {bill['label']}", "detail": f"${bill['amount']:,.2f} on {bill['date']}. {bill['origin']}.", "page": "semester", "priority": "normal"})
    if not actions:
        actions.append({"id": f"check-{now}", "title": "Check the week ahead", "detail": "No immediate issue detected in the available data. Confirm upcoming bills and changes in work hours.", "page": "semester", "priority": "normal"})
    return {"endDate": str(end), "variableSpending": round(float(np.median(daily_spend[:, :7].sum(axis=1))), 2),
            "scheduledBills": round(float(scheduled_expenses[1:8].sum()), 2),
            "scheduledIncome": round(float(scheduled_income[1:8].sum()), 2),
            "extraRoom": liquidity["safeToSetAside"], "upcoming": upcoming[:12], "actions": actions[:3],
            "note": "Extra room is a one-time modeled margin beyond already projected spending, protecting the full forecast, buffer and goals. It is not a weekly allowance or guaranteed money."}


def account_outlooks(request, ledger, transactions, excluded_ids, overridden):
    accounts = [a for a in request.accounts if a.type == "depository" and a.currency == "CAD"]
    known_ids = {a.id for a in accounts}
    default_id = accounts[0].id if len(accounts) == 1 else None
    unassigned = sum(1 for e in ledger if e["date"] <= str(request.asOf + timedelta(days=14)) and (e.get("accountId") or default_id) not in known_ids)
    result = []
    for account in accounts:
        rows = [t for t in transactions if t.accountId == account.id and 0 <= (request.asOf - t.date).days < 56]
        coverage = min(56, (request.asOf - min((t.date for t in rows), default=request.asOf)).days + 1)
        burn = sum(-t.cashFlow for t in rows if t.cashFlow < 0 and t.id not in excluded_ids and t.category not in overridden and t.forecastTreatment != "one_off") / max(1, coverage)
        balance = account.balance - sum(-t.cashFlow for t in request.transactions if t.accountId == account.id and t.pending and t.cashFlow < 0)
        minimum, first = balance, None
        for day in range(1, 15):
            when = str(request.asOf + timedelta(days=day))
            balance -= burn
            for event in ledger:
                if event["date"] == when and (event.get("accountId") or default_id) == account.id:
                    balance += event["amount"] * (1 if event["direction"] == "income" else -1)
            minimum = min(minimum, balance)
            if balance < 0 and first is None:
                first = when
        result.append({"accountId": account.id, "minimum": round(minimum, 2), "ending": round(balance, 2), "firstNegativeDate": first,
                       "dailyVariableOutflow": round(burn, 2), "historyDays": coverage, "unassignedPayments": unassigned,
                       "status": "partial" if coverage < 28 or unassigned or request.lifeEvents else "modeled"})
    return {"days": 14, "accounts": result, "note": "Account estimates use observed variable outflows and assigned planned/detected payments. Unassigned payments, future transfers, variable pay and life-event adjustments are not allocated across accounts. Pending outflows are reserved. No account-specific risk probability is claimed."}
