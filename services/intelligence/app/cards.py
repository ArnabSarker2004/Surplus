"""Explainable rewards comparison using observed net purchases, never projected debt."""
from collections import defaultdict
from datetime import date, timedelta
from .card_catalog import CARDS, REVIEWED
from .contracts import ForecastRequest

GROUPS = {
    "Groceries": "Groceries", "Eating Out": "Dining", "Coffee": "Dining",
    "TTC and PRESTO": "Transit", "Rideshare": "Transit", "Entertainment": "Entertainment",
    "Fitness": "Fitness", "Shopping": "Other purchases", "Textbooks and Supplies": "Other purchases",
    "Healthcare": "Other purchases", "Phone and Internet": "Bills", "Subscriptions": "Bills",
}


def estimate(card_id, monthly, preferences):
    """Steady typical month; apply shared caps before allocating category rewards."""
    factor = preferences.amexAcceptancePercent / 100 if card_id == "cobalt" else 1
    spending = {k: max(0, v) * factor for k, v in monthly.items()}
    base = .01 if card_id == "cobalt" else .005
    rewards = {k: v * base for k, v in spending.items()}
    chosen = []

    def bonus(groups, rate, monthly_cap=float("inf")):
        total = sum(spending.get(g, 0) for g in groups)
        if total <= 0:
            return
        extra = min(total, monthly_cap) * (rate - base)
        for group in groups:
            rewards[group] = rewards.get(group, 0) + extra * spending.get(group, 0) / total

    if card_id == "tangerine":
        allowed = {"Groceries", "Dining", "Transit", "Entertainment", "Fitness"}
        if preferences.recurringBills:
            allowed.add("Bills")
        chosen = sorted((g for g in spending if g in allowed and spending[g] > 0), key=lambda g: (-spending[g], g))[:3 if preferences.tangerineSavings else 2]
        bonus(chosen, .02)
    elif card_id == "bmo":
        bonus(["Groceries"], .03, 500)
        if preferences.recurringBills:
            bonus(["Bills"], .01, 500)
    elif card_id == "simplii":
        bonus(["Dining"], .04, 5000 / 12)
        bonus(["Groceries", "Bills"] if preferences.recurringBills else ["Groceries"], .015, 15000 / 12)
    elif card_id == "cobalt":
        bonus(["Groceries", "Dining"], .05, 2500)
        bonus(["Transit"], .02)
    return rewards, chosen


def compare_cards(request: ForecastRequest):
    now, pref = request.asOf, request.options.cardPreferences
    cutoff = now - timedelta(days=89)
    observed = [t for t in request.transactions if cutoff <= t.date <= now and t.currency == "CAD" and not t.pending]
    days = (now - min(t.date for t in observed)).days + 1 if observed else 0
    totals = defaultdict(float)
    excluded = 0.0
    for t in observed:
        # Never earn rewards on repayments, transfers, unreviewed charges, rent or tuition.
        group = GROUPS.get(t.category)
        if group and t.classification in {"Essential", "Flexible", "Discretionary"}:
            totals[group] -= t.cashFlow  # Identified purchase refunds reduce category spending.
        elif t.cashFlow < 0 and t.classification != "Transfer":
            excluded += -t.cashFlow
    monthly = {group: max(0, total) * 365.25 / 12 / max(days, 30) for group, total in totals.items()}
    enough = days >= 30 and sum(monthly.values()) > 0
    rows = []
    for card in CARDS:
        rewards, chosen = estimate(card["id"], monthly, pref)
        gross = sum(rewards.values()) * 12
        rows.append({**card, "annualRewards": round(gross, 2) if enough else None,
                     "annualNet": round(gross - card["annualFee"], 2) if enough else None,
                     "annualPoints": round(gross * 100) if enough and card["kind"] == "Points" else None,
                     "chosenCategories": chosen,
                     "breakdown": [{"category": group, "monthlySpend": round(monthly[group], 2),
                                    "annualRewards": round(rewards.get(group, 0) * 12, 2)} for group in sorted(monthly)],
                     })
    rows.sort(key=lambda c: (-(c["annualNet"] or 0), c["annualFee"], c["id"]))
    stale = (date.today() - date.fromisoformat(REVIEWED)).days > 90
    warnings = [
        "These are four Canadian options, not a market-wide search or an approval prediction.",
        "Estimates assume the same spending mix for a year and full, on-time statement payments. Interest, surcharges, welcome bonuses and insurance values are excluded.",
        "Issuer merchant codes and card acceptance can differ from Plaid categories. Rent, tuition, transfers and unreviewed purchases are excluded; healthcare is modeled at the base rate.",
        "Monthly caps use a typical calendar month; annual caps use twelve repeated months. Uneven spending and statement dates can change actual rewards.",
        "Points use the published 1 cent per point statement-credit value. Travel-transfer values and streaming bonuses are not assumed.",
    ]
    if not enough:
        warnings.insert(0, "At least 30 observed days with categorized purchases are needed for annual reward estimates.")
    elif days < 90:
        warnings.insert(0, "Less than 90 days of history: this is an early spending-based estimate.")
    if stale:
        warnings.insert(0, "Catalogue review is over 90 days old. Rankings are paused until issuer terms are reviewed.")
    return dict(reviewedAt=REVIEWED, stale=stale, observedDays=days, enoughHistory=enough,
                monthlyEligibleSpend=round(sum(monthly.values()), 2), excludedOutflows=round(excluded, 2),
                paidInFull=pref.paidInFull, warnings=warnings, cards=rows,
                recommendedId=rows[0]["id"] if enough and not stale and pref.paidInFull == "yes" else None)
