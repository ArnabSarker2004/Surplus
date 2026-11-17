from collections import defaultdict
from datetime import timedelta
import numpy as np
from .calendar import occurrences

RECURRING_CATEGORIES = {"Housing", "Phone and Internet", "Subscriptions", "Fitness", "TTC and PRESTO"}


def recurring_streams(transactions, as_of, end):
    groups = defaultdict(list)
    for t in transactions:
        if (t.cashFlow > 0 and t.category == "Employment Income") or (t.cashFlow < 0 and t.category in RECURRING_CATEGORIES):
            groups[(t.accountId, t.merchantKey or t.merchant.casefold().strip(), t.category)].append(t)
    streams = []
    for group in groups.values():
        group.sort(key=lambda t: t.date)
        # Multiple same-day rows do not provide evidence of a payment cadence.
        if len(group) < 3 or len({t.date for t in group}) != len(group):
            continue
        gaps = np.diff([t.date.toordinal() for t in group])
        typical = float(np.median(gaps))
        cadence, days = min([("Weekly", 7), ("Biweekly", 14), ("Monthly", 30.44)], key=lambda pair: abs(pair[1] - typical))
        tolerance = 4 if cadence == "Monthly" else 2
        if np.mean(np.abs(gaps - days) <= tolerance) < 0.8 or (as_of - group[-1].date).days > days * 1.7:
            continue
        amounts = np.abs([t.cashFlow for t in group])
        amount = float(np.median(amounts[-3:]))
        if amount == 0 or np.median(np.abs(amounts - amount)) / amount > 0.2:
            continue
        dates = occurrences(group[-1].date, cadence, as_of + timedelta(days=1), end)
        streams.append({"accountId": group[-1].accountId, "merchant": group[-1].merchant, "category": group[-1].category,
                        "amount": round(amount, 2), "direction": "income" if group[-1].cashFlow > 0 else "expense",
                        "frequency": cadence, "nextDate": dates[0].isoformat() if dates else None,
                        "observations": len(group), "confidence": "Pattern detected; confirm it is still active",
                        "ids": {t.id for t in group}, "dates": dates})
    return streams


def spending_patterns(transactions, as_of):
    groups = defaultdict(list)
    for t in transactions:
        if t.cashFlow < 0 and t.classification not in {"Income", "Transfer", "Review"}:
            groups[t.category].append(t)
    categories, anomalies = [], []
    for category, group in groups.items():
        recent = sum(-t.cashFlow for t in group if (as_of - t.date).days < 30)
        previous = sum(-t.cashFlow for t in group if 30 <= (as_of - t.date).days < 60)
        categories.append({"category": category, "last30": round(recent, 2), "previous30": round(previous, 2),
                           "changePercent": round((recent / previous - 1) * 100, 1) if previous > 0 else None})
        for t in group:
            if (as_of - t.date).days > 30:
                continue
            earlier = [-other.cashFlow for other in group if other.date < t.date]
            if len(earlier) < 5:
                continue
            median = float(np.median(earlier))
            mad = float(np.median(np.abs(np.asarray(earlier) - median)))
            if -t.cashFlow > max(median * 2.5, median + 4 * 1.4826 * mad, 50):
                anomalies.append({"id": t.id, "merchant": t.merchant, "date": t.date.isoformat(),
                                  "amount": round(-t.cashFlow, 2), "category": category,
                                  "typicalAmount": round(median, 2), "reason": "Larger than your earlier purchases in this category; not a fraud determination."})
    return sorted(categories, key=lambda c: -c["last30"]), sorted(anomalies, key=lambda a: -a["amount"])[:8]
