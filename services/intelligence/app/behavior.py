"""Within-person observations, with explicit exposure, validation and missing-data gates.

No clinical/intent inference; no user data leaves this process. Purchase counts are
modeled separately from dollars, because frequent small purchases and one large
purchase should not produce the same intervention.
"""
from collections import defaultdict
from datetime import timedelta
from zoneinfo import ZoneInfo
import numpy as np
from sklearn.linear_model import PoissonRegressor
from sklearn.metrics import mean_poisson_deviance
from .habits import DAYS, optional
from .patterns import RECURRING_CATEGORIES

ZONE = ZoneInfo("America/Toronto")
RESEARCH = [
    {"title": "Paycheck receipt and consumption timing", "url": "https://www.nber.org/papers/w9356",
     "detail": "Research motivates comparing days around pay. It does not show why a particular person spent money; scheduled payments can explain the pattern."},
    {"title": "Payday and economic decision-making", "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC5167530/",
     "detail": "Findings on short-term scarcity and cognition are mixed. Surplus does not infer stress, self-control or a psychological condition."},
    {"title": "Hawkes calibration and timestamp quality", "url": "https://arxiv.org/abs/1308.6756",
     "detail": "Clustering alone can mislead a self-exciting model. Surplus uses validated daily Poisson rates and descriptive sequences, not a causal impulse score."},
]


def stamp(t, now):
    value = t.authorizedAt
    if value is None or value.tzinfo is None:
        return None
    local = value.astimezone(ZONE)
    if local.date() > now or local.date() > t.date or (t.date - local.date()).days > 14:
        return None
    return local


def purchase_date(t, now):
    timestamp = stamp(t, now)
    if timestamp:
        return timestamp.date()
    if t.authorizedDate and 0 <= (t.date - t.authorizedDate).days <= 14:
        return t.authorizedDate
    return t.date


def frequency(rows, start, end, purchases):
    days = (end - start).days
    counts = np.zeros(days)
    for t, day in purchases:
        counts[(day - start).days] += 1
    calendar = np.array([(start + timedelta(days=i)).weekday() for i in range(days)])
    rates = np.zeros(7)
    observed = np.zeros(7)
    weeks = days // 7
    for day in range(7):
        values = counts[calendar == day]
        observed[day] = values.mean() if len(values) else 0
    # Shrink the descriptive rate by two exposure days toward the overall mean.
    for day in range(7):
        rates[day] = (observed[day] * weeks + (counts.mean() if days else 0) * 2) / (weeks + 2)
    selected, validation = "Smoothed weekday counts", None
    if days >= 56 and counts.sum() >= 30 and counts[:-14].sum() >= 15:
        features = np.eye(7)[calendar]
        model = PoissonRegressor(alpha=0.15, max_iter=200)
        model.fit(features[:-14], counts[:-14])
        pred = model.predict(features[-14:])
        baseline = max(0.01, float(counts[:-14].mean()))
        candidate_score = float(mean_poisson_deviance(counts[-14:], np.maximum(0.01, pred)))
        baseline_score = float(mean_poisson_deviance(counts[-14:], np.full(14, baseline)))
        selected = "Constant Poisson rate"
        rates[:] = counts.mean()
        if candidate_score < baseline_score * .95:
            model.fit(features, counts)
            rates = model.predict(np.eye(7))
            selected = "Weekday Poisson regression"
        validation = {"days": 14, "baselineDeviance": round(baseline_score, 3),
                      "weekdayDeviance": round(candidate_score, 3)}
    return {"method": selected, "weeks": weeks, "events": len(purchases), "validation": validation,
            "days": [{"weekday": day, "label": DAYS[day], "observed": round(float(observed[day]), 2),
                      "expected": round(float(rates[day]), 2)} for day in range(7)],
            "note": "Optional purchase counts, including zero-purchase days in complete weeks. After eight weeks and 30 purchases, weekday Poisson regression must beat a constant-rate baseline by 5% on the final 14 days. Imports may omit activity; rates are not calibrated risk probabilities."}


def paycheck_comparison(rows, purchases, start, end):
    paydates = sorted({t.date for t in rows if t.category == "Employment Income" and t.cashFlow > 0
                       and start + timedelta(days=7) <= t.date < end - timedelta(days=2)})
    # Match each post-payday day to exactly the same weekday one week earlier.
    # Exclude controls near any other paycheck, and overlapping cycle exposures.
    all_pay = {t.date for t in rows if t.category == "Employment Income" and t.cashFlow > 0}
    occupied, pairs, cycles = set(), [], 0
    totals = defaultdict(float)
    for t, day in purchases:
        totals[day] -= t.cashFlow
    for payday in paydates:
        window = [payday + timedelta(days=i) for i in range(3)]
        controls = [day - timedelta(days=7) for day in window]
        if any(day in occupied for day in window + controls):
            continue
        if any(0 <= (day - pay).days <= 2 for day in controls for pay in all_pay):
            continue
        pairs.extend(zip(window, controls))
        occupied.update(window + controls)
        cycles += 1
    if cycles < 4:
        return {"status": "insufficient", "cycles": cycles, "after": None, "comparison": None, "changePercent": None,
                "note": "Four non-overlapping pay cycles with matching weekdays are needed. Only categorized employment deposits count as pay."}
    after = float(np.mean([totals[a] for a, _ in pairs]))
    before = float(np.mean([totals[b] for _, b in pairs]))
    return {"status": "observed", "cycles": cycles, "after": round(after, 2), "comparison": round(before, 2),
            "changePercent": round((after / before - 1) * 100, 1) if before >= 1 else None,
            "note": "Optional daily spending on payday and the following two days, compared with the same weekdays one week earlier. This descriptive association can reflect plans, seasonality or income timing; it is not proof of a trigger."}


def merchant_trends(rows, now):
    groups = defaultdict(list)
    for t in rows:
        if t.cashFlow < 0 and t.classification not in {"Transfer", "Income", "Review"}:
            groups[(t.accountId, t.merchantKey or t.merchant.casefold().strip(), t.category)].append(t)
    charges, tickets, merchants = [], [], []
    for group in groups.values():
        group.sort(key=lambda t: (t.date, t.id))
        recent = [t for t in group if t.date > now - timedelta(days=90)]
        if len(recent) >= 3:
            merchants.append({"merchant": group[-1].merchant, "category": group[-1].category,
                              "visits": len(recent), "total": round(sum(-t.cashFlow for t in recent), 2)})
        # Two disjoint three-month windows. This is a basket-size proxy, NOT inflation.
        old = [-t.cashFlow for t in group if 90 <= (now - t.date).days < 180]
        new = [-t.cashFlow for t in recent]
        if len(old) >= 4 and len(new) >= 4:
            before, after = float(np.median(old)), float(np.median(new))
            if before >= 1 and abs(after / before - 1) >= .1:
                tickets.append({"merchant": group[-1].merchant, "category": group[-1].category,
                                "before": round(before, 2), "after": round(after, 2),
                                "changePercent": round((after / before - 1) * 100, 1),
                                "earlierCount": len(old), "recentCount": len(new)})
        if group[-1].category not in RECURRING_CATEGORIES or len(group) < 6:
            continue
        dates = [t.date for t in group]
        gaps = np.diff([d.toordinal() for d in dates])
        if len(set(dates)) != len(dates) or np.mean((gaps >= 26) & (gaps <= 35)) < .8 or (now - dates[-1]).days > 45:
            continue
        # Monthly recurrence score: autocorrelation of a binary daily event series.
        series = np.zeros((dates[-1] - dates[0]).days + 1)
        for day in dates:
            series[(day - dates[0]).days] = 1
        correlations = [float(np.corrcoef(series[:-lag], series[lag:])[0, 1]) for lag in range(26, 36)
                        if np.std(series[:-lag]) > 0 and np.std(series[lag:]) > 0]
        score = max(correlations, default=0)
        before = float(np.median([-t.cashFlow for t in group[:3]]))
        after = float(np.median([-t.cashFlow for t in group[-3:]]))
        if before >= 1 and after > before * 1.05 and after - before >= 1 and score >= .2:
            charges.append({"merchant": group[-1].merchant, "category": group[-1].category,
                            "before": round(before, 2), "after": round(after, 2),
                            "annualExtra": round((after - before) * 12, 2), "observations": len(group),
                            "correlation": round(score, 2), "lastDate": dates[-1].isoformat()})
    return sorted(charges, key=lambda r: -r["annualExtra"])[:6], sorted(tickets, key=lambda r: -abs(r["changePercent"]))[:6], sorted(merchants, key=lambda r: -r["visits"])[:8]


def analyze_behavior(request):
    now = request.asOf
    rows = [t for t in request.transactions if t.currency == "CAD" and not t.pending and now - timedelta(days=365) <= t.date <= now]
    oldest = max(min((purchase_date(t, now) for t in rows), default=now), now - timedelta(days=182))
    start = oldest + timedelta(days=(7 - oldest.weekday()) % 7)
    end = now - timedelta(days=now.weekday())
    if start > end:
        start = end
    purchases = [(t, purchase_date(t, now)) for t in rows if t.cashFlow < 0 and optional(t)
                 and t.classification not in {"Transfer", "Income", "Review"} and start <= purchase_date(t, now) < end]
    # A split receipt remains one purchase event, even across several optional categories.
    events = {}
    for t, day in purchases:
        key = t.eventId or t.id
        if key in events:
            first, first_day = events[key]
            events[key] = (first.model_copy(update={"cashFlow": first.cashFlow + t.cashFlow}), first_day)
        else:
            events[key] = (t, day)
    purchases = list(events.values())
    timed = sorted([(stamp(t, now), t) for t, _ in purchases if stamp(t, now)], key=lambda pair: (pair[0], pair[1].id))
    windows, sequences, locations = defaultdict(list), defaultdict(list), defaultdict(list)
    for dt, t in timed:
        windows[(dt.weekday(), dt.hour // 3 * 3)].append((dt, t))
    # Consecutive events only; the same purchase cannot create dozens of pairings.
    for (previous_time, previous), (dt, t) in zip(timed, timed[1:]):
        gap = (dt - previous_time).total_seconds()
        if 0 < gap <= 7200 and dt.date() == previous_time.date() and previous.category != t.category:
            sequences[(previous.category, t.category)].append((dt, t))
    for t, _ in purchases:
        if t.location and t.location.city and t.paymentChannel != "online":
            key = (t.location.city.strip().casefold(), (t.location.region or "").casefold(), (t.location.country or "").casefold())
            locations[key].append(t)
    window_report = [{"weekday": day, "day": DAYS[day], "startHour": hour, "endHour": hour + 3,
                      "events": len(items), "distinctDays": len({dt.date() for dt, _ in items}),
                      "shareOfTimed": round(len(items) / max(1, len(timed)) * 100, 1),
                      "total": round(sum(-t.cashFlow for _, t in items), 2)}
                     for (day, hour), items in windows.items() if len({dt.date() for dt, _ in items}) >= 3]
    sequence_report = [{"from": a, "to": b, "occurrences": len(items), "distinctDays": len({dt.date() for dt, _ in items})}
                       for (a, b), items in sequences.items() if len({dt.date() for dt, _ in items}) >= 3]
    charges, tickets, merchants = merchant_trends(rows, now)
    details = defaultdict(lambda: {"amount": 0.0, "purchases": 0})
    for t in rows:
        if 0 <= (now - t.date).days < 90 and t.classification not in {"Income", "Transfer", "Review"}:
            label = t.detailLabel or "No confirmed detail"
            details[(t.category, label)]["amount"] -= t.cashFlow
            details[(t.category, label)]["purchases"] += int(t.cashFlow < 0)
    return {"frequency": frequency(rows, start, end, purchases), "timezone": "America/Toronto",
            "coverage": {"purchases": len(purchases), "timestamped": len(timed),
                         "located": sum(len(items) for items in locations.values()),
                         "purchaseDateKnown": sum(1 for t, _ in purchases if stamp(t, now) or t.authorizedDate)},
            "windows": sorted(window_report, key=lambda r: -r["events"])[:4],
            "sequences": sorted(sequence_report, key=lambda r: -r["occurrences"])[:4],
            "locations": sorted([{"city": group[-1].location.city, "region": group[-1].location.region,
                                  "country": group[-1].location.country, "visits": len(group),
                                  "total": round(sum(-t.cashFlow for t in group), 2)}
                                 for group in locations.values() if len(group) >= 3], key=lambda r: -r["visits"])[:6],
            "merchants": merchants, "payday": paycheck_comparison(rows, purchases, start, end),
            "detailSpending": sorted([{"category": category, "detail": label, "amount": round(max(0, value["amount"]), 2), "purchases": value["purchases"]}
                                      for (category, label), value in details.items() if value["amount"] > 0], key=lambda item: -item["amount"])[:12],
            "risingCharges": charges, "ticketTrends": tickets, "research": RESEARCH,
            "notes": ["Times use genuine authorization timestamps converted to Toronto time; posting timestamps are never used to claim a two-hour purchase sequence. At least three distinct days are needed for a time-window or sequence observation.",
                      "Location summaries use city/region/country only, exclude online purchases and require three visits. No address, GPS, home/work inference or external geocoding is used. Missing location is not proof of an online purchase.",
                      "Recurring charge changes compare the first and last three observed charges, with monthly cadence and autocorrelation checks. They do not establish whether a service is unused or still active.",
                      "Merchant ticket trends compare median purchase amounts across two 90-day windows with at least four purchases each. Different basket sizes, tips and quantities prevent interpreting this as personal price inflation."]}
