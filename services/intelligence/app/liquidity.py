"""Simulation-based cash pressure and a conservative, non-executing savings preview."""
import numpy as np
from datetime import timedelta


def liquidity_report(request, dates, balances, buffer, can_score, cash_known, ledger, transactions, savings_balances=None):
    horizons = []
    for days in [7, 14]:
        paths = balances[:, :days + 1]
        median = np.median(paths, axis=0)
        first = next((i for i, value in enumerate(median) if value < buffer), None)
        horizons.append({"days": days, "minimumMedian": round(float(median.min()), 2) if cash_known else None,
                         "bufferBreachShare": round(float(np.mean(np.any(paths < buffer, axis=1))) * 100, 1) if can_score else None,
                         "negativeShare": round(float(np.mean(np.any(paths < 0, axis=1))) * 100, 1) if can_score else None,
                         "firstPressureDate": dates[first].isoformat() if first is not None and cash_known else None})
    recent = [t for t in transactions if t.cashFlow < 0 and t.classification not in {"Transfer", "Income"}
              and 0 <= (request.asOf - t.date).days < 5]
    burn = sum(-t.cashFlow for t in recent) / 5
    # Protect the entire requested horizon, not just next payday. Reserve the remaining
    # goals too; this optional sweep must not spend a tuition/goal allocation twice.
    goal_need = sum(max(0, g.target - g.current) for g in request.goals)
    saving_paths = savings_balances if savings_balances is not None else balances
    raw = float(np.quantile(np.min(saving_paths, axis=1), .1)) - buffer - goal_need
    stale = request.syncedAt is not None and request.syncedAt[:10] < str(request.asOf - timedelta(days=3))
    safe = max(0, np.floor(raw * 100) / 100) if can_score and not stale else None
    pay = next((item for item in sorted(ledger, key=lambda item: item["date"]) if item["direction"] == "income"), None)
    return {"method": "Cash-flow path simulation", "horizons": horizons, "protectedBalance": round(buffer, 2),
            "fiveDayOutflowPerDay": round(burn, 2), "nextIncome": pay,
            "safeToSetAside": safe, "protectedDays": request.options.horizonDays,
            "status": "stale" if stale else "available" if can_score else "insufficient",
            "notes": ["Personal set-aside estimates exclude detected or flagged non-personal funding and future loan/grant deposits. Other bank cash is personal by default; bills, goals and the minimum buffer are still protected.",
                      "Percentages count simulated paths, not calibrated overdraft probabilities. Historical daily bank balances and labeled low-balance events are not available to train a logistic or survival model.",
                      "This is combined CAD cash pressure after credit and pending reserves, not an account-specific overdraft prediction. A payment from one account can fail even if another holds money.",
                      "The optional set-aside amount protects the 10th percentile of each path's lowest balance over the whole forecast, your buffer, saved goals and all remaining goal targets. It is a one-time preview, never a daily transfer or a guarantee.",
                      "The five-day outflow rate is descriptive and includes bills. Detected pay dates are estimates. Confirm account balances and obligations before moving money."]}
