"""Repeated calendar patterns are prompts for reflection, not inferred intent."""
from collections import defaultdict
from datetime import timedelta
import numpy as np

DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
CATEGORIES = {"Eating Out", "Coffee", "Shopping", "Entertainment", "Rideshare"}


def optional(t):
    if t.category not in CATEGORIES or t.habitTreatment == "routine":
        return False
    return t.habitTreatment == "optional" or t.classification in {"Flexible", "Discretionary"}


def complete_history(transactions, now):
    valid = [t for t in transactions if t.currency == "CAD" and not t.pending and now - timedelta(days=84) <= t.date <= now]
    oldest = min((t.date for t in valid), default=now)
    start = oldest + timedelta(days=(7 - oldest.weekday()) % 7)
    end = now - timedelta(days=now.weekday())
    weeks = max(0, (end - start).days // 7)
    return [t for t in valid if start <= t.date < end], start, end, weeks


def weekday_profile(transactions, now):
    rows, _, _, weeks = complete_history(transactions, now)
    totals = np.zeros(7)
    for t in rows:
        if t.category != "Employment Income" and t.classification not in {"Income", "Transfer"}:
            totals[t.date.weekday()] -= t.cashFlow
    totals = np.maximum(0, totals)
    if weeks < 4 or not totals.sum():
        return np.full(7, 1 / 7)
    # Two prior weeks of uniform spending limit overreaction to a single large purchase.
    smoothed = totals + totals.sum() / weeks * 2 / 7
    return smoothed / smoothed.sum()


def intervention_shares(transactions, now, adjustment):
    if not adjustment:
        return np.zeros(7)
    rows, _, _, weeks = complete_history(transactions, now)
    if weeks < 4:
        return np.zeros(7)
    total, target = 0.0, 0.0
    for t in rows:
        if t.date.weekday() != adjustment.weekday or t.category == "Employment Income":
            continue
        total -= t.cashFlow
        if t.category == adjustment.category and optional(t):
            target -= t.cashFlow
    shares = np.zeros(7)
    shares[adjustment.weekday] = min(1, max(0, target) / max(total, 1)) * adjustment.reductionPercent / 100
    return shares


def weekly_habits(request):
    rows, start, end, weeks = complete_history(request.transactions, request.asOf)
    rows = [t for t in rows if t.classification not in {"Transfer", "Income"}]
    groups = defaultdict(list)
    day_totals = [{"weekday": i, "label": name, "optional": 0.0, "groceries": 0.0, "routine": 0.0, "occurrences": weeks} for i, name in enumerate(DAYS)]
    unknown = 0
    for t in rows:
        if t.classification == "Review" or t.category == "Other":
            if t.cashFlow < 0:
                unknown += 1
            continue
        kind = "groceries" if t.category == "Groceries" else "optional" if optional(t) else "routine"
        day_totals[t.date.weekday()][kind] -= t.cashFlow
        if optional(t):
            groups[(t.date.weekday(), t.category)].append(t)
    for row in day_totals:
        for key in ["optional", "groceries", "routine"]:
            row[key] = round(max(0, row[key]) / max(1, weeks), 2)
    patterns = []
    for (weekday, category), txs in groups.items():
        active = len({(t.date - start).days // 7 for t in txs if t.cashFlow < 0})
        average = max(0, sum(-t.cashFlow for t in txs)) / max(weeks, 1)
        other = max(0, sum(-t.cashFlow for (day, cat), items in groups.items() if day != weekday and cat == category for t in items)) / max(1, weeks * 6)
        ratio = average / max(1, other)
        if weeks < 4 or active < max(3, weeks / 2) or average < 8 or ratio < 1.4:
            continue
        patterns.append({"id": f"{weekday}-{category}", "weekday": weekday, "day": DAYS[weekday], "category": category,
                         "weeklyAverage": round(average, 2), "activeWeeks": active, "totalWeeks": weeks, "ratio": round(ratio, 1),
                         "monthlyChangeAt25": round(average * 52.18 / 12 * .25, 2),
                         "transactionIds": [t.id for t in sorted(txs, key=lambda t: t.date, reverse=True) if t.cashFlow < 0][:12],
                         "explanation": f"{category} appeared on {active} of {weeks} observed {DAYS[weekday]}s. Average spending was {ratio:.1f} times the average on other weekdays. This does not establish whether the purchases were necessary or unplanned."})
    review = sorted([t for t in rows if t.cashFlow < 0 and t.category in CATEGORIES and t.classification != "Review"], key=lambda t: (t.date, t.id), reverse=True)[:20]
    return {"weeks": weeks, "start": start.isoformat() if weeks else None, "end": (end - timedelta(days=1)).isoformat() if weeks else None,
            "days": day_totals, "patterns": sorted(patterns, key=lambda p: -p["weeklyAverage"])[:4],
            "review": [{"id": t.id, "merchant": t.merchant, "date": t.date.isoformat(), "amount": round(-t.cashFlow, 2), "category": t.category, "treatment": t.habitTreatment} for t in review],
            "unknownCount": unknown, "interventionMonthlySavings": 0,
            "notes": ["Uses complete weeks and averages across all occurrences of each weekday, including zero-spend days. At least four complete weeks and three repeated occurrences are required for a prompt.",
                      "Groceries and routine purchases are kept separate. A bank transaction does not contain receipt items, shopping intent, or proof of an impulse purchase.",
                      "Mark a purchase as routine or planned to exclude it from habit prompts. It still counts toward spending and forecasts. Unreviewed transactions are not labeled discretionary.",
                      "Pending activity, foreign currencies and the current incomplete week are excluded. Posting dates can differ from the day you made a purchase."]}
