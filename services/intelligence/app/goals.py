"""Every goal competes for the same cash pool at every forecast date."""
import numpy as np


def allocate_goals(request, dates, balances, scenario_balances, constant_balances, buffer, cash_known, can_score):
    pools = [np.maximum(0, np.minimum.accumulate(paths[:, ::-1], axis=1)[:, ::-1] - buffer) for paths in (balances, scenario_balances, constant_balances)]
    allocated = [np.zeros_like(pool) for pool in pools]
    reports = []
    days = len(dates) - 1

    def first(values, target):
        hits = np.where(values >= target - .005)[0]
        return dates[int(hits[0])].isoformat() if len(hits) and cash_known else None

    for goal in sorted(request.goals, key=lambda g: ({"High": 0, "Medium": 1, "Low": 2}[g.priority], g.date, g.id)):
        remaining = max(0, goal.target - goal.current)
        contributions = [np.minimum(remaining, np.maximum(0, pool - used)) for pool, used in zip(pools, allocated)]
        for used, contribution in zip(allocated, contributions):
            used += contribution
        quantiles = np.quantile(contributions[0], [.1, .5, .9], axis=0)
        scenario = np.median(contributions[1], axis=0)
        constant = np.median(contributions[2], axis=0)
        idx = (goal.date - request.asOf).days
        within = 0 <= idx <= days
        clamped = max(0, min(days, idx))
        projected = goal.current + quantiles[1, clamped]
        steps = sorted(set([0, days, clamped] + list(range(7, days, 7))))
        reports.append({"id": goal.id, "name": goal.name, "target": goal.target, "current": goal.current,
                        "deadline": goal.date.isoformat(), "priority": goal.priority,
                        "projectedDate": first(quantiles[1], remaining), "scenarioDate": first(scenario, remaining),
                        "constantPriceDate": first(constant, remaining),
                        "earliestDate": first(quantiles[2], remaining) if can_score else None,
                        "cautiousDate": first(quantiles[0], remaining) if can_score else None,
                        "status": "forecast" if within else "past_deadline" if idx < 0 else "beyond_horizon",
                        "projectedAmount": round(float(projected), 2) if cash_known else None,
                        "scenarioAmount": round(float(goal.current + scenario[clamped]), 2) if cash_known else None,
                        "successRate": round(float(np.mean(contributions[0][:, clamped] >= remaining - .005) * 100), 2) if within and can_score else None,
                        "extraPerMonth": round(max(0, float(goal.target - projected)) / max(1, idx / 30.4375), 2) if within and cash_known else None,
                        "trajectory": [{"date": dates[i].isoformat(), "amount": round(float(goal.current + quantiles[1, i]), 2),
                                        "scenario": round(float(goal.current + scenario[i]), 2), "low": round(float(goal.current + quantiles[0, i]), 2),
                                        "high": round(float(goal.current + quantiles[2, i]), 2)} for i in steps] if cash_known else []})
    weekly_room = max(0, float(np.quantile(pools[0][:, 0] - allocated[0][:, 0], .1))) / (days / 7)
    return reports, round(weekly_room, 2) if can_score else None
