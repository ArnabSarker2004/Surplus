import { ArrowRight, Check, Plus } from 'lucide-react';
import { useState } from 'react';
import { chartMoney } from '../components/chart-format';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { asOf, cad, plan, scenarioPlan } from '../../../shared/finance';
import { emptyScenario } from '../../../shared/schema';
import {
  Badge,
  Button,
  Field,
  MoneyInput,
  PageHead,
  SectionTitle,
  TextLink,
} from '../components/ui';
import { useApp } from '../lib';

export function ScenarioPage() {
  const { w, state, save, busy, navigate } = useApp();
  const [s, setS] = useState(w.scenario);
  const p = plan(w, state.opportunities);
  const hypothetical = scenarioPlan(w, state.opportunities, s);
  const update = (key: keyof typeof s, value: number | string | null) =>
    setS({ ...s, [key]: value });
  const timeline = p.timeline.map((t, i) => {
    const past = t.month < asOf(w).slice(0, 7);
    const activeMonths = p.timeline
      .slice(0, i + 1)
      .filter((m) => m.month >= asOf(w).slice(0, 7)).length;
    const opp = state.opportunities.find((o) => o.id === s.opportunityId);
    return {
      label: t.label,
      base: t.balance,
      scenario:
        t.balance +
        (past
          ? 0
          : activeMonths * (s.monthlyReduction + s.monthlyIncome - s.monthlySavings) +
            s.oneTimeIncome -
            s.oneTimeExpense +
            (opp && opp.paymentDate.slice(0, 7) <= t.month ? hypothetical.opportunityIncome : 0)),
    };
  });
  return (
    <>
      <PageHead
        eyebrow="THE WHAT-IF PLANNER"
        title="Small changes. New possibilities."
        description="Try a different path for your semester. Your base plan stays yours."
        action={<Badge tone="blue">Hypothetical scenario</Badge>}
      />
      <div className="scenario-grid">
        <section className="card scenario-controls">
          <SectionTitle
            title="Make a little room"
            subtitle={`${p.remainingMonths} monthly planning periods remain`}
          />
          <div className="form-stack">
            <Field label="Name this scenario">
              <input value={s.name} onChange={(e) => update('name', e.target.value)} />
            </Field>
            <Field
              label="Spend less each month"
              hint="An amount you could realistically reduce from your planned costs."
            >
              <MoneyInput
                value={s.monthlyReduction}
                onChange={(v) => update('monthlyReduction', v)}
              />
              <input
                type="range"
                aria-label="Monthly spending reduction slider"
                min="0"
                max="500"
                step="10"
                value={s.monthlyReduction}
                onChange={(e) => update('monthlyReduction', +e.target.value)}
              />
            </Field>
            <Field label="Additional income each month">
              <MoneyInput value={s.monthlyIncome} onChange={(v) => update('monthlyIncome', v)} />
            </Field>
            <Field label="What if I receive an opportunity?">
              <select
                value={s.opportunityId ?? ''}
                onChange={(e) => update('opportunityId', e.target.value || null)}
              >
                <option value="">No opportunity selected</option>
                {state.opportunities
                  .filter((o) => w.applications[o.id] !== 'Awarded')
                  .map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.provider} · {cad(o.amount)}
                    </option>
                  ))}
              </select>
            </Field>
            <details className="details">
              <summary>
                More possibilities <Plus size={15} />
              </summary>
              <div className="form-stack">
                <Field label="Other one-time income">
                  <MoneyInput
                    value={s.oneTimeIncome}
                    onChange={(v) => update('oneTimeIncome', v)}
                  />
                </Field>
                <Field label="One-time future expense">
                  <MoneyInput
                    value={s.oneTimeExpense}
                    onChange={(v) => update('oneTimeExpense', v)}
                  />
                </Field>
                <Field
                  label="Set aside for goals each month"
                  hint="Moves cash out of this spending plan; it is not a new expense or income."
                >
                  <MoneyInput
                    value={s.monthlySavings}
                    onChange={(v) => update('monthlySavings', v)}
                  />
                </Field>
              </div>
            </details>
            <Button
              disabled={busy}
              onClick={() =>
                void save({ ...w, scenario: s }, 'Your what-if scenario is saved.').catch(() => {})
              }
            >
              Save scenario <Check size={16} />
            </Button>
            <Button variant="ghost" onClick={() => setS({ ...emptyScenario })}>
              Reset changes
            </Button>
          </div>
        </section>
        <div className="scenario-results">
          <section className="scenario-result-hero">
            <Badge tone="green">Your hypothetical outlook</Badge>
            <h2>A little change could go a long way.</h2>
            <div className="scenario-comparison">
              <div>
                <span>Base ending balance</span>
                <strong>{cad(p.ending)}</strong>
              </div>
              <ArrowRight size={25} />
              <div>
                <span>With your changes</span>
                <strong>{cad(hypothetical.ending)}</strong>
              </div>
            </div>
            <div className="scenario-improvement">
              {hypothetical.improvement >= 0 ? '+' : ''}
              {cad(hypothetical.improvement)} in semester breathing room
            </div>
          </section>
          <section className="card">
            <SectionTitle title="Two paths. One semester." />
            <div
              className="chart-wrap"
              role="img"
              aria-label={`Base ending balance ${cad(p.ending)}; hypothetical ending balance ${cad(hypothetical.ending)}`}
            >
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={timeline} margin={{ left: 4, right: 18, top: 20 }}>
                  <CartesianGrid vertical={false} stroke="#e6e7df" strokeDasharray="3 5" />
                  <XAxis
                    padding={{ left: 12, right: 12 }}
                    minTickGap={22}
                    tick={{ fontSize: 11 }}
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    width={68}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={chartMoney}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip formatter={(v: number) => cad(v)} />
                  <Legend />
                  <Area
                    name="Base plan"
                    type="monotone"
                    dataKey="base"
                    stroke="#b6b6a9"
                    fill="transparent"
                    strokeDasharray="4 4"
                    isAnimationActive={false}
                  />
                  <Area
                    name="What-if plan"
                    type="monotone"
                    dataKey="scenario"
                    stroke="#365c45"
                    fill="#e8f0df"
                    fillOpacity={0.5}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="mini-stats">
              <div>
                <small>Remaining funding gap</small>
                <strong>{cad(hypothetical.gap)}</strong>
              </div>
              <div>
                <small>Original gap covered</small>
                <strong>{Math.round(hypothetical.coveredPercent)}%</strong>
              </div>
              <div>
                <small>Additional goal savings</small>
                <strong>{cad(hypothetical.savingsAllocated)}</strong>
              </div>
            </div>
            <div className="inline-notice">
              {hypothetical.ending >= w.semester.minimumBalance
                ? 'This scenario meets your desired semester balance.'
                : `${cad(hypothetical.targetGap)} more is needed to reach your desired balance.`}{' '}
              Your scenario does not change funding, goal balances, or bank accounts.
            </div>
          </section>
          <p className="field-note">
            Monthly changes apply to the current month and each remaining semester month in full.
            Other one-time amounts apply to the current month; opportunities use their sample
            payment date. Awards already in the base plan are excluded. This is a planning
            illustration.
          </p>
          <TextLink onClick={() => navigate('goals')}>See your savings goals</TextLink>
        </div>
      </div>
    </>
  );
}
