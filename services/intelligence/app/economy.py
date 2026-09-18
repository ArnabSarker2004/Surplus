"""Public category CPI supplies explicit price assumptions, not a personal inflation forecast."""
from collections import defaultdict
from datetime import date
import numpy as np

CATEGORY_INDEX = {
    "Groceries": "groceries", "Eating Out": "dining", "Coffee": "dining",
    "TTC and PRESTO": "transit", "Rideshare": "transit", "Healthcare": "health",
    "Entertainment": "recreation", "Fitness": "recreation", "Textbooks and Supplies": "recreation",
    "Phone and Internet": "household", "Subscriptions": "household",
}


class PriceContext:
    def __init__(self, request):
        self.request = request
        self.mode = request.options.inflation.mode
        self.indices, self.rates, self.labels = {}, {}, {}
        self.notes = []
        self.period = None
        self.status = "off" if self.mode == "off" else "custom" if self.mode == "custom" else "unavailable"
        if self.mode == "observed" and request.economy.region == request.options.inflation.region:
            for series in request.economy.series:
                points = sorted([p for p in series.points if p.period <= request.asOf and p.releasedAt[:10] <= request.asOf.isoformat()], key=lambda p: p.period)
                if not points:
                    continue
                last = points[-1]
                if (request.asOf - last.period).days > 120:
                    continue
                previous = next((p for p in points if p.period == date(last.period.year - 1, last.period.month, 1)), None)
                if not previous:
                    continue
                rate = last.value / previous.value - 1
                self.rates[series.key] = float(np.clip(rate, -.05, .20))
                if rate < -.05 or rate > .20:
                    self.notes.append(f"{series.label}: the modeled annual rate is bounded between -5% and 20%.")
                self.indices[series.key] = points
                self.labels[series.key] = series.label
                self.period = max(self.period or last.period, last.period)
            if "all" in self.rates:
                self.status = request.economy.status
            else:
                self.indices, self.rates = {}, {}
                self.notes.append("Current CPI data could not be verified. No inflation adjustment was applied; choose a custom rate or retry later.")
        self.notes.extend([
            "Latest year-over-year CPI rates are held constant as an explicit price scenario, not an official prediction or your measured personal inflation.",
            "Only modeled variable spending changes with prices. Entered bills, rent, tuition, income and nominal goal targets stay at their saved amounts.",
            "Broad spending categories use the all-items index when no closer series is available. Shopping is not assumed to be clothing.",
        ])
        if self.mode == "observed" and self.rates:
            self.notes.append("Historical variable purchases are restated at the latest published category price level before training, then future price growth is applied. Holdout errors use those restated amounts, not a real-time CPI-vintage backtest.")
        elif self.mode == "custom":
            self.notes.append("Your custom rate applies to future variable spending only. Existing nominal spending trends may already include price changes.")

    def key(self, category):
        key = CATEGORY_INDEX.get(category, "all")
        return key if key in self.rates else "all"

    def rate(self, category):
        if self.mode == "custom":
            return self.request.options.inflation.annualRate / 100
        return self.rates.get(self.key(category), 0) if self.mode == "observed" else 0

    def normalize(self, transaction):
        if self.mode != "observed" or transaction.category == "Employment Income":
            return transaction.cashFlow
        points = self.indices.get(self.key(transaction.category), [])
        historical = [p for p in points if p.period <= transaction.date.replace(day=1)]
        if not historical:
            return transaction.cashFlow
        factor = points[-1].value / historical[-1].value
        return transaction.cashFlow * float(np.clip(factor, .5, 2))

    def basket(self, transactions, days):
        totals = defaultdict(float)
        for t in transactions:
            if t.category != "Employment Income":
                totals[t.category] -= self.normalize(t)
        totals = {key: max(0, value) for key, value in totals.items()}
        total = sum(totals.values())
        factors = np.zeros(days)
        elapsed = np.arange(1, days + 1) / 365.25
        for category, value in totals.items():
            factors += value / max(total, 1) * np.power(1 + self.rate(category), elapsed)
        if not total:
            factors[:] = 1
        return factors, totals

    def report(self, totals, history_days, price_cost):
        total = sum(totals.values())
        weighted = sum(self.rate(c) * value for c, value in totals.items()) / total if total else None
        return {
            "status": self.status, "mode": self.mode, "region": self.request.options.inflation.region,
            "period": self.period.isoformat()[:7] if self.period else None,
            "fetchedAt": self.request.economy.fetchedAt, "sourceUrl": self.request.economy.sourceUrl,
            "weightedAnnualRate": round(weighted * 100, 2) if weighted is not None and self.status != "unavailable" else None,
            "extraCost": round(float(np.median(price_cost.sum(axis=1))), 2),
            "extraCostNext30": round(float(np.median(price_cost[:, :30].sum(axis=1))), 2),
            "historicalNormalization": self.mode == "observed" and bool(self.rates),
            "categories": [{"category": c, "sourceLabel": self.labels.get(self.key(c), "Custom assumption" if self.mode == "custom" else "No adjustment"),
                            "annualRate": round(self.rate(c) * 100, 2), "monthlySpend": round(value / max(history_days, 30) * 30.4375, 2)}
                           for c, value in sorted(totals.items(), key=lambda item: -item[1]) if value > 0],
            "notes": self.notes,
        }
