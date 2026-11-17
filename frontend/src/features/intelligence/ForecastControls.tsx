import type { ForecastOptions } from '../../../../shared/intelligence';
import { useState } from 'react';
import { Button, Field, MoneyInput } from '../../components/ui';

export function ForecastControls({
  options: o,
  update,
  run,
  busy,
  demo,
  endDate,
  reset,
}: {
  options: ForecastOptions;
  update: (patch: Partial<ForecastOptions>) => void;
  run: () => void;
  busy: boolean;
  demo: boolean;
  endDate: string;
  reset: () => void;
}) {
  const [view, setView] = useState('changes');
  return (
    <div className="forecast-controls">
      <div
        className="forecast-segment student-subnav"
        role="group"
        aria-label="Forecast adjustments"
      >
        {[
          ['changes', 'Income & spending'],
          ['balance', 'Cash & tuition'],
          ['prices', 'Prices'],
          ['cards', 'Cards'],
        ].map(([id, label]) => (
          <button key={id} type="button" aria-pressed={view === id} onClick={() => setView(id)}>
            {label}
          </button>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run();
        }}
      >
        <fieldset disabled={busy || demo}>
          <p className="field-note">
            These changes let you explore a possibility. They won’t change your saved bills,
            budgets, or bank balance.
          </p>
          {view === 'changes' && (
            <div className="intelligence-control-grid">
              <Field label="Look ahead">
                <select
                  value={o.horizonDays}
                  onChange={(e) => update({ horizonDays: Number(e.target.value) })}
                >
                  {[
                    [30, '30 days'],
                    [90, '90 days'],
                    [180, '6 months'],
                    [365, '1 year'],
                    [730, '2 years'],
                  ].map(([v, name]) => (
                    <option key={v} value={v}>
                      {name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Extra monthly income" hint="A what-if assumption, not confirmed pay.">
                <MoneyInput
                  value={o.monthlyExtraIncome}
                  max={100000}
                  onChange={(monthlyExtraIncome) => update({ monthlyExtraIncome })}
                />
              </Field>
              <Field label="Reduce flexible spending">
                <select
                  value={o.flexibleReductionPercent}
                  onChange={(e) => update({ flexibleReductionPercent: Number(e.target.value) })}
                >
                  {[0, 5, 10, 15, 20, 30, 50, 80].map((v) => (
                    <option key={v} value={v}>
                      {v ? `${v}% less` : 'Keep current habits'}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          )}
          {view === 'prices' && (
            <section>
              <div className="intelligence-control-grid">
                <Field label="Allow for changing prices">
                  <select
                    value={o.inflation.mode}
                    onChange={(e) =>
                      update({
                        inflation: {
                          ...o.inflation,
                          mode: e.target.value as ForecastOptions['inflation']['mode'],
                        },
                      })
                    }
                  >
                    <option value="observed">Use published inflation data</option>
                    <option value="custom">Explore my own rate</option>
                    <option value="off">No price adjustment</option>
                  </select>
                </Field>
                <Field label="Price data region">
                  <select
                    value={o.inflation.region}
                    disabled={o.inflation.mode !== 'observed'}
                    onChange={(e) =>
                      update({
                        inflation: {
                          ...o.inflation,
                          region: e.target.value as 'Ontario' | 'Canada',
                        },
                      })
                    }
                  >
                    <option>Ontario</option>
                    <option>Canada</option>
                  </select>
                </Field>
                {o.inflation.mode === 'custom' && (
                  <Field label="Annual price change (%)">
                    <input
                      type="number"
                      min={-5}
                      max={20}
                      step={0.1}
                      value={o.inflation.annualRate}
                      onChange={(e) =>
                        update({
                          inflation: { ...o.inflation, annualRate: Number(e.target.value) },
                        })
                      }
                    />
                  </Field>
                )}
              </div>
            </section>
          )}
          {o.habitAdjustment && (
            <div className="inline-notice">
              What-if: {o.habitAdjustment.reductionPercent}% less{' '}
              {o.habitAdjustment.category.toLowerCase()} on{' '}
              {
                [
                  'Mondays',
                  'Tuesdays',
                  'Wednesdays',
                  'Thursdays',
                  'Fridays',
                  'Saturdays',
                  'Sundays',
                ][o.habitAdjustment.weekday]
              }
              .{' '}
              <Button
                type="button"
                variant="ghost"
                onClick={() => update({ habitAdjustment: null })}
              >
                Remove habit adjustment
              </Button>
            </div>
          )}
          {view === 'balance' && (
            <section>
              <label className="intelligence-check">
                <input
                  type="checkbox"
                  checked={!!o.tuition}
                  onChange={(e) =>
                    update({
                      tuition: e.target.checked ? { amount: 1000, dueDate: endDate } : null,
                    })
                  }
                />
                Explore a different tuition bill
              </label>
              {o.tuition && (
                <div className="intelligence-control-grid">
                  <Field label="Tuition amount">
                    <MoneyInput
                      value={o.tuition.amount}
                      min={0.01}
                      max={10000000}
                      onChange={(amount) => update({ tuition: { ...o.tuition!, amount } })}
                    />
                  </Field>
                  <Field label="Tuition due date">
                    <input
                      type="date"
                      required
                      value={o.tuition.dueDate}
                      onChange={(e) =>
                        update({ tuition: { ...o.tuition!, dueDate: e.target.value } })
                      }
                    />
                  </Field>
                  <p className="field-note">
                    Replaces tuition in this forecast only. Your saved bills stay as entered.
                  </p>
                </div>
              )}
              <label className="intelligence-check">
                <input
                  type="checkbox"
                  checked={o.openingCash !== null}
                  onChange={(e) => update({ openingCash: e.target.checked ? 0 : null })}
                />
                Use my own current cash balance
              </label>
              {o.openingCash !== null && (
                <Field
                  label="Total current cash"
                  hint="Include saved goals. Credit and pending outflows are reserved separately."
                >
                  <MoneyInput
                    value={o.openingCash}
                    max={10000000}
                    onChange={(openingCash) => update({ openingCash })}
                  />
                </Field>
              )}
            </section>
          )}
          {view === 'cards' && (
            <section>
              <div className="intelligence-control-grid">
                <Field label="Do you pay card statements in full?">
                  <select
                    value={o.cardPreferences.paidInFull}
                    onChange={(e) =>
                      update({
                        cardPreferences: {
                          ...o.cardPreferences,
                          paidInFull: e.target.value as 'unknown' | 'yes' | 'no',
                        },
                      })
                    }
                  >
                    <option value="unknown">Not specified</option>
                    <option value="yes">Yes, every month</option>
                    <option value="no">No, I carry a balance</option>
                  </select>
                </Field>
                <Field label="Spending where Amex is accepted">
                  <select
                    value={o.cardPreferences.amexAcceptancePercent}
                    onChange={(e) =>
                      update({
                        cardPreferences: {
                          ...o.cardPreferences,
                          amexAcceptancePercent: Number(e.target.value),
                        },
                      })
                    }
                  >
                    {[100, 75, 50, 25, 0].map((v) => (
                      <option key={v} value={v}>
                        {v}% of eligible purchases
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <label className="intelligence-check">
                <input
                  type="checkbox"
                  checked={o.cardPreferences.tangerineSavings}
                  onChange={(e) =>
                    update({
                      cardPreferences: { ...o.cardPreferences, tangerineSavings: e.target.checked },
                    })
                  }
                />
                I would deposit Tangerine rewards into its savings account (third bonus category)
              </label>
              <label className="intelligence-check">
                <input
                  type="checkbox"
                  checked={o.cardPreferences.recurringBills}
                  onChange={(e) =>
                    update({
                      cardPreferences: { ...o.cardPreferences, recurringBills: e.target.checked },
                    })
                  }
                />
                My phone, internet and subscription bills qualify as pre-authorized card payments
              </label>
            </section>
          )}
          <div className="button-row">
            <Button type="submit" disabled={busy}>
              Update outlook
            </Button>
            <Button type="button" variant="ghost" onClick={reset}>
              Reset changes
            </Button>
          </div>
        </fieldset>
        {demo && <p>This sample outlook stays fixed. Sign in to try changes with your own plan.</p>}
      </form>
    </div>
  );
}
