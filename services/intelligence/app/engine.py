"""Ledger-aware forecast assembly. A model never creates or moves money."""
from datetime import timedelta
import hashlib
import math
import numpy as np
from .contracts import ForecastRequest
from .calendar import occurrences
from .models import forecast_series
from .patterns import recurring_streams, spending_patterns
from .economy import PriceContext
from .habits import weekly_habits, weekday_profile, intervention_shares
from .goals import allocate_goals
from .behavior import analyze_behavior
from .liquidity import liquidity_report
from .action_plan import action_plan, account_outlooks
from .student import uses_work_schedule, student_outlook

VERSION = "surplus-forecast-1.0"
FLEXIBLE = {"Eating Out", "Coffee", "Rideshare", "Shopping", "Entertainment", "Subscriptions", "Fitness"}


def money(value):
    return round(float(value), 2)


def analyze(request: ForecastRequest):
    now, options = request.asOf, request.options
    days = options.horizonDays
    end, start = now + timedelta(days=days), now + timedelta(days=1)
    dates = [now + timedelta(days=i) for i in range(days + 1)]
    # Only observed posted CAD activity, at/before the snapshot, can train a model.
    eligible = [t for t in request.transactions if not t.pending and t.currency == "CAD" and t.date <= now and t.date >= now - timedelta(days=730)]
    transactions = [t for t in eligible if t.classification != "Transfer"]
    oldest = min((t.date for t in eligible), default=now)
    history_days = (now - oldest).days + 1 if eligible else 0
    latest = max((t.date for t in eligible), default=None)
    prices = PriceContext(request)
    habits = weekly_habits(request)
    accounts = [a for a in request.accounts if a.currency == "CAD"]
    cash_accounts = [a for a in accounts if a.type == "depository"]
    known_cash = options.openingCash is not None or bool(cash_accounts)
    cash = options.openingCash if options.openingCash is not None else sum(a.balance for a in cash_accounts)
    credit_reserve = sum(max(0, a.balance) for a in accounts if a.type == "credit")
    pending_reserve = sum(-t.cashFlow for t in request.transactions if t.pending and t.currency == "CAD" and t.cashFlow < 0 and t.classification != "Transfer")
    goal_reserve = sum(min(g.current, g.target) for g in request.goals)
    opening = cash - credit_reserve - pending_reserve
    warnings = []
    if history_days < 90:
        warnings.append("Less than 90 days of observed history. Forecast ranges and simulated success rates are exploratory.")
    if not cash_accounts and options.openingCash is None:
        warnings.append("No CAD cash account balance is available. Enter current cash to estimate affordability; credit limits are never cash.")
    if latest and (now - latest).days > 14:
        warnings.append("The latest posted transaction is over 14 days old. Sync and verify that the linked accounts cover your everyday spending.")
    review_count = sum(t.reviewRequired for t in eligible)
    if review_count:
        warnings.append(f"{review_count} transaction{'s' if review_count != 1 else ''} need{'s' if review_count == 1 else ''} a category or corrected split.")
    if goal_reserve > max(0, opening):
        warnings.append("Saved goal balances exceed usable linked cash. Goal savings are assumed to be inside the starting cash balance; check missing accounts and saved amounts.")
    if pending_reserve:
        warnings.append("Pending outflows are reserved once at the start, not used for training. Verify the bank has not already included them in its current balance.")
    if request.syncedAt and request.syncedAt[:10] < (now - timedelta(days=3)).isoformat():
        warnings.append("The bank snapshot is more than three days old. Sync transactions before relying on current balances.")

    expenses = list(request.expenses)
    if options.tuition:
        from .contracts import Expense
        expenses = [e for e in expenses if e.category != "Tuition and School"] + [Expense(id="custom-tuition", name="Tuition target", amount=options.tuition.amount, date=options.tuition.dueDate, category="Tuition and School", frequency="Once")]
    scheduled_expenses, scheduled_income = np.zeros(days + 1), np.zeros(days + 1)
    protected_income = np.zeros(days + 1)
    tuition_events, ledger = [], []
    overridden = {e.category for e in expenses if e.frequency == "Monthly" and e.date <= end}
    # Tuition is a known, lumpy obligation, not something to learn as weekly consumption.
    overridden.add("Tuition and School")
    for expense in expenses:
        for when in occurrences(expense.date, expense.frequency, start, end):
            index = (when - now).days
            scheduled_expenses[index] += expense.amount
            ledger.append({"date": when.isoformat(), "label": expense.name, "amount": money(expense.amount), "direction": "expense", "origin": "Your plan", "accountId": expense.accountId})
            if expense.category == "Tuition and School":
                tuition_events.append((expense.id, expense.name, when, expense.amount))
        if expense.category == "Tuition and School" and not occurrences(expense.date, expense.frequency, start, end):
            tuition_events.append((expense.id, expense.name, expense.date, expense.amount))
    for fund in request.funding:
        if fund.status != "Confirmed" and not (fund.type == "Earned" and fund.status == "Expected"):
            continue
        due_dates = occurrences(fund.date, fund.frequency, start, min(end, fund.endDate or end))
        for when in due_dates:
            scheduled_income[(when - now).days] += fund.amount
            if fund.type in {"Repayable", "Non-repayable"}:
                protected_income[(when - now).days] += fund.amount
            ledger.append({"date": when.isoformat(), "label": fund.name, "amount": money(fund.amount), "direction": "income", "origin": "Your plan", "accountId": fund.accountId})
    planned_pay = uses_work_schedule(request)
    if planned_pay:
        warnings.append("Job income follows your saved pay schedule, including its end dates. No historical wages are added in gaps between jobs. Include every job you expect to keep.")
    streams = recurring_streams([t for t in transactions if t.forecastTreatment == "automatic"], now, end)
    excluded_ids = set()
    for stream in streams:
        replaced = (stream["direction"] == "income" and planned_pay) or (stream["direction"] == "expense" and stream["category"] in overridden)
        stream["included"] = not replaced
        if replaced:
            continue
        excluded_ids.update(stream["ids"])
        for when in stream["dates"]:
            amount = stream["amount"]
            if stream["direction"] == "expense":
                scheduled_expenses[(when - now).days] += amount
            else:
                scheduled_income[(when - now).days] += amount
            ledger.append({"date": when.isoformat(), "label": stream["merchant"], "amount": amount, "direction": stream["direction"], "origin": "Detected pattern", "accountId": stream["accountId"]})

    residual = [t for t in transactions if t.forecastTreatment != "one_off" and t.id not in excluded_ids and
                ((t.category == "Employment Income" and t.cashFlow > 0 and not planned_pay) or
                 (t.classification != "Income" and t.category not in overridden and
                  not (t.cashFlow > 0 and t.classification == "Review")))]
    # Complete Monday-Sunday weeks only. Do not mistake a partial import for a low-spend week.
    first_monday = oldest + timedelta(days=(7 - oldest.weekday()) % 7)
    this_monday = now - timedelta(days=now.weekday())
    weeks = max(0, (this_monday - first_monday).days // 7)
    spend, income = np.zeros(weeks), np.zeros(weeks)
    flexible_total, spending_total = 0.0, 0.0
    for t in residual:
        index = (t.date - first_monday).days // 7
        if t.cashFlow < 0:
            spending_total -= t.cashFlow
            if t.category in FLEXIBLE:
                flexible_total -= t.cashFlow
        if not 0 <= index < weeks:
            continue
        if t.category == "Employment Income" and t.cashFlow > 0:
            income[index] += t.cashFlow
        else:
            # Category refunds reduce expenditure, not a new income stream.
            spend[index] -= prices.normalize(t)
    spend = np.maximum(spend, 0)
    if weeks == 0 and history_days:
        spend = np.array([max(0, sum(-prices.normalize(t) for t in residual if t.category != "Employment Income")) / history_days * 7])
        income = np.array([sum(t.cashFlow for t in residual if t.category == "Employment Income" and t.cashFlow > 0) / history_days * 7])
    future_weeks = math.ceil(days / 7)
    expense_model = forecast_series(spend, future_weeks, "Variable weekly spending")
    income_model = forecast_series(income, future_weeks, "Variable weekly earnings")
    if not weeks:
        for model in (expense_model, income_model):
            model.report["trainingWeeks"] = 0
            model.report["reason"] = "Partial-history daily average only; no complete training week is available."
    if planned_pay:
        income_model.report["reason"] = "Your work schedule replaces historical earnings. Pay stops at each saved last payday, including jobs that have already ended."
    # Labels and evidence may change without monetary history changing. Keep common draws;
    # a changed recurring stream still affects predictions through the model itself.
    seed_payload = request.model_dump(mode="json", exclude={"options", "economy", "syncedAt", "lifeEvents", "savingsEligibleCash"})
    for t in seed_payload["transactions"]:
        for key in ["habitTreatment", "authorizedDate", "authorizedAt", "location", "paymentChannel",
                    "merchant", "merchantKey", "merchantSource", "merchantConfidence", "detailCategory", "detailLabel", "categoryOrigin"]:
            t.pop(key, None)
    import json
    seed = int(hashlib.sha256(json.dumps(seed_payload, sort_keys=True).encode()).hexdigest()[:8], 16)
    simulations = 400
    # Resample errors in two-week blocks rather than pretend each day is independent.
    def simulated_weekly(model, seed_offset):
        rng = np.random.default_rng(seed + seed_offset)
        residuals = model.residuals
        errors = np.empty((simulations, future_weeks))
        for i in range(0, future_weeks, 2):
            choice = rng.integers(0, len(residuals), size=simulations)
            errors[:, i] = residuals[choice]
            if i + 1 < future_weeks:
                errors[:, i + 1] = residuals[(choice + 1) % len(residuals)]
        return np.maximum(0, model.predictions[None, :] + errors)
    weekly_spend, weekly_income = simulated_weekly(expense_model, 0), simulated_weekly(income_model, 1)
    weekdays = np.array([d.weekday() for d in dates[1:]])
    profile = weekday_profile(residual, now)
    constant_daily_spend = np.repeat(weekly_spend, 7, axis=1)[:, :days] * profile[weekdays][None, :]
    recent_residual = [t for t in residual if t.date > now - timedelta(days=90)]
    price_factors, price_totals = prices.basket(recent_residual, days)
    daily_spend = constant_daily_spend * price_factors[None, :]
    price_cost = daily_spend - constant_daily_spend
    daily_income = np.repeat(weekly_income / 7, 7, axis=1)[:, :days]
    # Dated changes are explicit net cash assumptions, spread across active days.
    for event in request.lifeEvents:
        for i, when in enumerate(dates[1:]):
            if event.start <= when <= event.end:
                daily_income[:, i] += event.weeklyIncomeChange / 7
                daily_spend[:, i] = np.maximum(0, daily_spend[:, i] + event.weeklyExpenseChange / 7)
    net = daily_income - daily_spend + scheduled_income[None, 1:] - scheduled_expenses[None, 1:]
    balances = np.column_stack([np.full(simulations, opening), opening + np.cumsum(net, axis=1)])
    constant_balances = balances + np.column_stack([np.zeros(simulations), np.cumsum(price_cost, axis=1)])
    flexible_share = flexible_total / spending_total if spending_total else 0
    # Scenario reductions touch variable discretionary consumption only, never rent/tuition.
    adjustment = daily_spend * flexible_share * options.flexibleReductionPercent / 100 + options.monthlyExtraIncome / 30.4375
    habit_shares = intervention_shares(residual, now, options.habitAdjustment)
    habit_savings = daily_spend * (1 - flexible_share * options.flexibleReductionPercent / 100) * habit_shares[weekdays][None, :]
    adjustment += habit_savings
    habits["interventionMonthlySavings"] = money(float(np.median(habit_savings.sum(axis=1))) / days * 30.4375)
    scenario_balances = balances + np.column_stack([np.zeros(simulations), np.cumsum(adjustment, axis=1)])
    quantiles = np.quantile(balances, [0.1, 0.5, 0.9], axis=0)
    scenario_quantiles = np.quantile(scenario_balances, [0.1, 0.5, 0.9], axis=0)
    constant_median = np.median(constant_balances, axis=0)
    buffer = request.minimumBalance + goal_reserve
    enough_history = history_days >= 28 and weeks >= 3
    can_score = known_cash and enough_history
    timeline = [{"date": d.isoformat(), "low": money(quantiles[0, i]) if known_cash else None,
                 "median": money(quantiles[1, i]) if known_cash else None, "high": money(quantiles[2, i]) if known_cash else None,
                 "scenario": money(scenario_quantiles[1, i]) if known_cash else None,
                 "constantPrices": money(constant_median[i]) if known_cash else None,
                 "netChange": money(quantiles[1, i] - opening)} for i, d in enumerate(dates)]
    tuition = []
    for ident, name, due, amount in tuition_events:
        idx = (due - now).days
        within = 0 < idx <= days
        available = balances[:, idx] - buffer if within else None  # Bill already subtracted.
        before = quantiles[1, :idx + 1].copy() if within else np.array([])
        if within:
            before[-1] += amount
        ready = next((dates[i].isoformat() for i, balance in enumerate(before) if balance >= amount + buffer), None) if known_cash else None
        gap = max(0, -float(np.median(available))) if within and known_cash else None
        tuition.append({"id": ident, "name": name, "dueDate": due.isoformat(), "amount": money(amount),
                        "status": "forecast" if within else "due_or_past" if idx <= 0 else "beyond_horizon",
                        "firstCashCoverageDate": ready, "gapAtDeadline": money(gap) if gap is not None else None,
                        "extraPerWeek": money(gap / max(1, idx / 7)) if gap is not None else None,
                        "successRate": money(np.mean(available >= 0) * 100) if within and can_score else None,
                        "scenarioSuccessRate": money(np.mean(scenario_balances[:, idx] >= buffer) * 100) if within and can_score else None})

    # Cash forecasts still include funding for school costs. Personal goal forecasts
    # protect loan/education/unreviewed cash and future grant/loan deposits separately.
    # Conservatively charge all spending to personal cash until the next review.
    savings_reserve = (max(0, cash - request.savingsEligibleCash) + np.cumsum(protected_income)
                       if request.savingsEligibleCash is not None else np.zeros(days + 1))
    savings_balances = balances - savings_reserve[None, :]
    goals, weekly_room = allocate_goals(request, dates, savings_balances, scenario_balances - savings_reserve[None, :], constant_balances - savings_reserve[None, :], buffer, known_cash, can_score)
    category_stats, anomalies = spending_patterns(transactions, now)
    low_hits = np.where(quantiles[1] < buffer)[0]
    next30 = min(30, days)
    expense30 = float(np.median(daily_spend[:, :next30].sum(axis=1))) + float(scheduled_expenses[:next30 + 1].sum())
    income30 = float(np.median(daily_income[:, :next30].sum(axis=1))) + float(scheduled_income[:next30 + 1].sum())
    recommendations = []
    for bill in tuition:
        if bill["gapAtDeadline"]:
            recommendations.append({"title": f"Close the gap for {bill['name']}", "detail": f"The median forecast is short by ${bill['gapAtDeadline']:,.2f} at the deadline. About ${bill['extraPerWeek']:,.2f} extra per week would close that modeled gap.", "action": "scenario"})
    if low_hits.size and known_cash:
        recommendations.append({"title": "Protect your cash buffer", "detail": f"The median path drops below your protected balance on {dates[int(low_hits[0])].isoformat()}. Review upcoming bills and confirmed funding.", "action": "semester"})
    if any(s["category"] == "Subscriptions" for s in streams):
        recommendations.append({"title": "Review recurring subscriptions", "detail": "Check the detected recurring payments below. A pattern is not proof that a subscription is still active.", "action": "transactions"})
    if not tuition:
        recommendations.append({"title": "Add a tuition deadline", "detail": "Enter a tuition amount and due date here, or add it to your semester plan, to calculate its funding gap.", "action": "tuition"})
    if not enough_history:
        recommendations.append({"title": "Build a longer spending history", "detail": "Sync available history and confirm your categories. At least four weeks are needed for simulated readiness scores; learned models need more history and must outperform a baseline.", "action": "settings"})
    liquidity = liquidity_report(request, dates, balances, buffer, can_score, known_cash, ledger, transactions, savings_balances)
    summary = {"cash": money(cash) if known_cash else None, "creditReserve": money(credit_reserve),
               "pendingReserve": money(pending_reserve), "goalReserve": money(goal_reserve), "buffer": money(request.minimumBalance),
               "startingUsableCash": money(opening) if known_cash else None,
               "incomeNext30": money(income30), "spendingNext30": money(expense30), "netNext30": money(income30 - expense30),
               "endingMedian": money(quantiles[1, -1]) if known_cash else None,
               "scenarioEndingMedian": money(scenario_quantiles[1, -1]) if known_cash else None,
               "bufferBreachDate": dates[int(low_hits[0])].isoformat() if low_hits.size and known_cash else None,
               "bufferBreachRate": money(np.mean(np.any(balances < buffer, axis=1)) * 100) if can_score else None,
               "safeWeeklyRoom": weekly_room}
    return {"version": VERSION, "asOf": now.isoformat(), "source": request.source, "horizonDays": days, "syncedAt": request.syncedAt,
            "quality": {"historyDays": history_days, "completeWeeks": weeks, "transactionCount": len({t.eventId or t.id for t in eligible}),
                        "excludedCount": len(request.transactions) - len(transactions), "cashKnown": known_cash,
                        "level": "limited" if not enough_history else "developing" if weeks < 16 else "established",
                        "warnings": warnings},
            "summary": summary, "timeline": timeline, "tuition": tuition, "goals": goals,
            "student": student_outlook(request, dates, balances, daily_spend, daily_income, scheduled_expenses, scheduled_income, known_cash, buffer),
            "economy": prices.report(price_totals, min(history_days, 90), price_cost), "habits": habits,
            "behavior": analyze_behavior(request),
            "liquidity": liquidity,
            "weeklyPlan": action_plan(request, ledger, liquidity, daily_spend, scheduled_expenses, scheduled_income, known_cash, transactions),
            "accountOutlooks": account_outlooks(request, ledger, transactions, excluded_ids, overridden),
            "lifeEvents": [e.model_dump(mode="json") for e in request.lifeEvents],
            "models": [expense_model.report, income_model.report],
            "recurring": [{k: v for k, v in s.items() if k not in {"ids", "dates"}} for s in streams],
            "categories": category_stats, "anomalies": anomalies, "upcoming": sorted(ledger, key=lambda e: (e["date"], e["label"]))[:30],
            "recommendations": recommendations[:6],
            "assumptions": [
                "The band is the 10th to 90th percentile of 400 modeled paths, not a guaranteed or calibrated 80% confidence interval. Success rates describe these simulations only.",
                "Variable spending uses a smoothed weekday profile when at least four complete weeks are available; otherwise it is spread evenly. Variable earnings are spread evenly. Posting dates and actual purchase dates can differ.",
                "Published category CPI supplies a price scenario for variable spending. Fixed entered bills, income and nominal goal targets are not automatically inflated. The chart can compare constant future prices.",
                "Current CAD cash is the starting balance. Credit balances, pending outflows, and existing goal savings are reserved. Investment and loan balances are not cash.",
                "Monthly expense plans replace learned spending in their category. Tuition uses entered dates only. Other one-time expenses are additional future obligations.",
                "Future confirmed funding and expected earned funding are included. Received money is already in the starting balance; applied or unconfirmed non-earned funding is excluded.",
                "Saved earned funding or a confirmed work schedule replaces detected and learned employment income across the full outlook, even after a job ends. Gaps have no job pay unless another saved job covers them. Grants, loans, dated changes and what-if income remain separate.",
                "Goals share one cash pool in priority/deadline order and protect the lowest remaining forecast balance through the horizon. Existing saved goal amounts must already be part of starting cash.",
                "Personal savings estimates use bank cash minus detected or flagged non-personal funding and future confirmed grant and loan deposits. Other bank cash is personal by default. A what-if opening balance is excluded from personal savings estimates.",
                "Tuition readiness tests cash after the bill, buffer, and existing savings reserves. Its first cash coverage date can be temporary; check the deadline result as well.",
                "A complete view requires all relevant accounts. Earliest observed activity does not prove uninterrupted coverage. An empty day in imported history is treated as no activity.",
                "The what-if path adds your assumed extra income and reduces only modeled variable flexible spending. It changes no saved plan and makes no payments.",
            ]}
