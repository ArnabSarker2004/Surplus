"""Grounded explanations: every number comes from the computed report, never an LLM."""


def money(value):
    return f"${value:,.2f} CAD" if value is not None else "not available yet"


def answers(report):
    summary, quality = report["summary"], report["quality"]
    tuition = []
    for bill in report["tuition"]:
        if bill["gapAtDeadline"] is None:
            tuition.append(f"{bill['name']} ({bill['dueDate']}): adjust the forecast horizon or confirm your cash balance before estimating readiness.")
        elif bill["gapAtDeadline"] > 0:
            tuition.append(f"{bill['name']} is short by {money(bill['gapAtDeadline'])} in the median path on {bill['dueDate']}. An additional {money(bill['extraPerWeek'])} each week is the modeled gap-closing target, after other bills and protected balances.")
        else:
            tuition.append(f"The median path covers {bill['name']} of {money(bill['amount'])} on {bill['dueDate']}. Review the simulated readiness rate and lower cash-flow path before committing that money.")
    goals = [f"{g['name']}: " + (f"median projected readiness {g['projectedDate']}" if g["projectedDate"] else "not projected to be fully funded within this horizon") + ". Goals share available cash in priority order." for g in report["goals"]]
    growth = sorted((c for c in report["categories"] if c["previous30"] > 0 and c["last30"] > c["previous30"]), key=lambda c: c["last30"] - c["previous30"], reverse=True)
    changes = [f"{c['category']} increased from {money(c['previous30'])} to {money(c['last30'])} across the last two 30-day windows. Check whether this was a one-time purchase before changing your budget." for c in growth[:3]]
    return [
        {"id": "tuition", "question": "Can I cover my tuition?", "answers": tuition or ["Add a tuition amount and future deadline to estimate when you can cover it."]},
        {"id": "goals", "question": "When could I reach my goals?", "answers": goals or ["Add savings goals in the app, then refresh this forecast to compare deadlines and funding gaps."]},
        {"id": "cash", "question": "What might the next month look like?", "answers": [f"Modeled incoming money: {money(summary['incomeNext30'])}. Modeled spending and planned bills: {money(summary['spendingNext30'])}. The difference is {money(summary['netNext30'])}.", f"Your cash buffer could be breached on {summary['bufferBreachDate']}. Review scheduled funding and tuition." if summary["bufferBreachDate"] else "The median path does not show a buffer breach within this horizon. The lower simulated path may still show risk."] if quality["cashKnown"] else ["Enter a cash balance or connect a CAD deposit account. Credit balances and limits do not establish available cash."]},
        {"id": "spending", "question": "What spending should I review?", "answers": changes or ["No positive category increase with a comparable prior 30-day window was detected. Review recurring payments and unusually large transactions below."]},
        {"id": "confidence", "question": "How much should I trust this forecast?", "answers": [f"This snapshot includes {quality['transactionCount']} posted CAD transactions over {quality['historyDays']} observed days, with {quality['completeWeeks']} complete weeks.", "Models are tested on later weeks using only earlier data. Learned models are used only when they outperform the recent-average baseline. Scheduled bills and recurring patterns are separate assumptions, not backtested guarantees.", "Ranges and success rates summarize 400 simulated paths. They are not calibrated probabilities. Job changes, unlinked accounts, missing history, new bills, and stale balances can change the outcome."]},
    ]
