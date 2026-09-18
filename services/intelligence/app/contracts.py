from datetime import date
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, FiniteFloat, model_validator


class Contract(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class Transaction(Contract):
    id: str = Field(max_length=160)
    accountId: str = Field(max_length=160)
    date: date
    merchant: str = Field(max_length=250)
    cashFlow: FiniteFloat
    category: str = Field(max_length=100)
    classification: str = Field(max_length=40)
    currency: str = Field(max_length=12)
    pending: bool
    source: Literal["demo", "live", "sandbox", "manual"]
    habitTreatment: Literal["automatic", "routine", "optional"] = "automatic"


class Account(Contract):
    id: str = Field(max_length=160)
    type: str = Field(max_length=30)
    balance: FiniteFloat
    currency: str = Field(max_length=12)
    source: Literal["demo", "live", "sandbox", "manual"]


class Expense(Contract):
    id: str = Field(max_length=160)
    name: str = Field(max_length=160)
    amount: float = Field(ge=0, le=10_000_000)
    date: date
    category: str = Field(max_length=100)
    frequency: Literal["Once", "Monthly"]


class Funding(Contract):
    id: str = Field(max_length=160)
    name: str = Field(max_length=160)
    amount: float = Field(ge=0, le=10_000_000)
    date: date
    endDate: date | None = None
    type: Literal["Non-repayable", "Repayable", "Earned", "Personal"]
    status: Literal["Expected", "Applied", "Confirmed", "Received"]
    frequency: Literal["Once", "Weekly", "Biweekly", "Monthly"]


class Goal(Contract):
    id: str = Field(max_length=160)
    name: str = Field(max_length=160)
    target: float = Field(gt=0, le=10_000_000)
    current: float = Field(ge=0, le=10_000_000)
    date: date
    priority: Literal["High", "Medium", "Low"]


class Tuition(Contract):
    amount: float = Field(gt=0, le=10_000_000)
    dueDate: date


class CardPreferences(Contract):
    paidInFull: Literal["unknown", "yes", "no"] = "unknown"
    tangerineSavings: bool = False
    recurringBills: bool = False
    amexAcceptancePercent: int = Field(default=100, ge=0, le=100)


class InflationOptions(Contract):
    mode: Literal["observed", "custom", "off"] = "observed"
    region: Literal["Ontario", "Canada"] = "Ontario"
    annualRate: float = Field(default=2, ge=-5, le=20)


class HabitAdjustment(Contract):
    weekday: int = Field(ge=0, le=6)
    category: Literal["Eating Out", "Coffee", "Shopping", "Entertainment", "Rideshare"]
    reductionPercent: float = Field(ge=0, le=100)


class CpiPoint(Contract):
    period: date
    value: float = Field(gt=0)
    releasedAt: str = Field(max_length=40)


class CpiSeries(Contract):
    key: Literal["all", "groceries", "dining", "household", "clothing", "transit", "health", "recreation"]
    label: str = Field(max_length=120)
    vector: int = Field(gt=0)
    points: list[CpiPoint] = Field(max_length=60)


class EconomicContext(Contract):
    region: Literal["Ontario", "Canada"] = "Ontario"
    status: Literal["live", "cached", "unavailable", "demo"] = "unavailable"
    fetchedAt: str | None = Field(default=None, max_length=40)
    sourceUrl: str = "https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1810000401"
    series: list[CpiSeries] = Field(default_factory=list, max_length=8)


class Options(Contract):
    horizonDays: int = Field(default=180, ge=30, le=730)
    inflation: InflationOptions = Field(default_factory=InflationOptions)
    habitAdjustment: HabitAdjustment | None = None
    openingCash: float | None = Field(default=None, ge=0, le=10_000_000)
    monthlyExtraIncome: float = Field(default=0, ge=0, le=100_000)
    flexibleReductionPercent: float = Field(default=0, ge=0, le=80)
    tuition: Tuition | None = None
    cardPreferences: CardPreferences = Field(default_factory=CardPreferences)


class ForecastRequest(Contract):
    asOf: date
    source: Literal["demo", "live", "sandbox", "manual"]
    syncedAt: str | None = Field(default=None, max_length=40)
    minimumBalance: float = Field(ge=0, le=10_000_000)
    transactions: list[Transaction] = Field(max_length=50_000)
    accounts: list[Account] = Field(max_length=100)
    expenses: list[Expense] = Field(max_length=100)
    funding: list[Funding] = Field(max_length=100)
    goals: list[Goal] = Field(max_length=30)
    options: Options = Field(default_factory=Options)
    economy: EconomicContext = Field(default_factory=EconomicContext)

    @model_validator(mode="after")
    def consistent_source(self):
        if any(t.source != self.source for t in self.transactions) or any(a.source != self.source for a in self.accounts):
            raise ValueError("Mixed workspace sources are not allowed")
        for rows in (self.accounts, self.transactions, self.expenses, self.funding, self.goals):
            if len({row.id for row in rows}) != len(rows):
                raise ValueError("Duplicate record IDs are not allowed")
        if self.options.tuition and self.options.tuition.dueDate < self.asOf:
            raise ValueError("The tuition deadline must be today or later")
        return self
