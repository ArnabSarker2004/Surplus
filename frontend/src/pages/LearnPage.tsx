import { BookOpen, Check, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { cad, investment, readiness } from '../../../shared/finance';
import { Badge, Button, Field, MoneyInput, PageHead, SectionTitle } from '../components/ui';
import { useApp } from '../lib';

export function LearnPage() {
  const { w, state, save, busy } = useApp();
  const ready = readiness(w, state.opportunities);
  const [initial, setInitial] = useState(500);
  const [monthly, setMonthly] = useState(50);
  const [years, setYears] = useState(10);
  const [rate, setRate] = useState(4);
  const [fee, setFee] = useState(0.5);
  const [room, setRoom] = useState(w.profile.tfsaRoom);
  const [profile, setProfile] = useState(w.profile);
  const illustration = investment(initial, monthly, years, rate, fee);
  const lessons = [
    [
      'Saving and investing have different jobs.',
      'Savings help with near-term bills and surprises. Investing exposes money to market risk in pursuit of long-term growth. Your tuition money needs to be available when tuition is due.',
    ],
    [
      'Risk is part of the picture.',
      'Investment values can fall. Higher potential returns generally involve more uncertainty. Consider when you need the money, your ability to absorb a loss, and your comfort seeing the balance change.',
    ],
    [
      'Diversification and fees matter.',
      'Holding different investments can reduce concentration risk, but cannot eliminate losses. Fees reduce what you keep and compound over time. Understand the costs before you invest.',
    ],
    [
      'An account is not an investment.',
      'A TFSA is an account type with tax rules. Cash or eligible investments can be held inside it. An investment does not become risk-free because it is held in a TFSA.',
    ],
  ];
  return (
    <>
      <PageHead
        eyebrow="LEARN & GROW"
        title="A little knowledge. A longer view."
        description="Financial confidence grows one idea at a time."
        action={<Badge tone="blue">Education, at your pace</Badge>}
      />
      <section className="readiness-hero">
        <span className="readiness-flower">✳</span>
        <div>
          <Badge tone="green">Your financial readiness</Badge>
          <h2>{ready.title}</h2>
          <p>{ready.reason}</p>
          <span className="small">
            Based only on your entered information. Educational guidance, not investment advice.
          </span>
        </div>
      </section>
      <details className="details">
        <summary>
          Update the assumptions behind your readiness <span>+</span>
        </summary>
        <div className="form-grid">
          <label className="checkbox-line">
            <input
              type="checkbox"
              checked={profile.highInterestDebt}
              onChange={(e) => setProfile({ ...profile, highInterestDebt: e.target.checked })}
            />{' '}
            I have high-interest debt
          </label>
          <label className="checkbox-line">
            <input
              type="checkbox"
              checked={profile.stableIncome}
              onChange={(e) => setProfile({ ...profile, stableIncome: e.target.checked })}
            />{' '}
            My income is stable
          </label>
          <Field label="Years before you need this money">
            <input
              type="number"
              min="0"
              max="50"
              value={profile.horizonYears}
              onChange={(e) => setProfile({ ...profile, horizonYears: +e.target.value })}
            />
          </Field>
          <Field label="Comfort with potential losses">
            <select
              value={profile.riskComfort}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  riskComfort: e.target.value as typeof profile.riskComfort,
                })
              }
            >
              <option>Low</option>
              <option>Medium</option>
              <option>High</option>
            </select>
          </Field>
        </div>
        <Button disabled={busy} onClick={() => void save({ ...w, profile }).catch(() => {})}>
          Update readiness
        </Button>
      </details>
      <div className="lesson-grid">
        {lessons.map(([title, body], i) => (
          <article className="card lesson-card" key={title}>
            <span className="lesson-number">0{i + 1}</span>
            <BookOpen size={20} />
            <h3>{title}</h3>
            <p>{body}</p>
          </article>
        ))}
      </div>
      <section className="card investment-calculator">
        <SectionTitle
          title="What can time do?"
          subtitle="Explore compound growth. The return below is an assumption, not a prediction."
          action={<Badge tone="amber">Hypothetical</Badge>}
        />
        <div className="calculator-grid">
          <div className="form-stack">
            <Field label="Starting amount">
              <MoneyInput value={initial} onChange={(v) => setInitial(Math.max(0, v))} />
            </Field>
            <Field label="Monthly contribution">
              <MoneyInput value={monthly} onChange={(v) => setMonthly(Math.max(0, v))} />
            </Field>
            <Field label={`Time horizon · ${years} years`}>
              <input
                type="range"
                min="1"
                max="40"
                value={years}
                onChange={(e) => setYears(+e.target.value)}
              />
            </Field>
            <Field label={`Hypothetical annual return · ${rate}%`}>
              <input
                type="range"
                min="-10"
                max="12"
                step="0.5"
                value={rate}
                onChange={(e) => setRate(+e.target.value)}
              />
            </Field>
            <Field label={`Annual fee estimate · ${fee}%`}>
              <input
                type="range"
                min="0"
                max="3"
                step="0.1"
                value={fee}
                onChange={(e) => setFee(+e.target.value)}
              />
            </Field>
          </div>
          <div>
            <div className="calculator-value">
              <span>Hypothetical future value</span>
              <strong>{cad(illustration.value)}</strong>
            </div>
            <div
              className="chart-wrap"
              role="img"
              aria-label={`After ${years} years: ${cad(illustration.contributions)} contributed, ${cad(illustration.growth)} hypothetical growth, ${cad(illustration.fees)} effect of fees.`}
            >
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={illustration.points} margin={{ left: 0, right: 10 }}>
                  <CartesianGrid stroke="#e7e8e0" vertical={false} />
                  <XAxis
                    dataKey="year"
                    tickFormatter={(v) => `${v}y`}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip formatter={(v: number) => cad(v)} />
                  <Area
                    name="Future value"
                    dataKey="value"
                    stroke="#315b42"
                    fill="#dce8d5"
                    isAnimationActive={false}
                  />
                  <Area
                    name="Contributions"
                    dataKey="contributions"
                    stroke="#b4ad99"
                    fill="transparent"
                    strokeDasharray="4 4"
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="mini-stats">
              <div>
                <small>Contributions</small>
                <strong>{cad(illustration.contributions)}</strong>
              </div>
              <div>
                <small>Hypothetical growth</small>
                <strong>{cad(illustration.growth)}</strong>
              </div>
              <div>
                <small>Effect of fees</small>
                <strong>{cad(illustration.fees)}</strong>
              </div>
            </div>
          </div>
        </div>
        <p className="field-note">
          Returns are not guaranteed. Values can fall, including below your contributions. This
          model assumes a constant annual return minus fees, monthly compounding, and contributions
          at month-end. It ignores taxes, inflation, and return variability. It does not recommend
          an investment.
        </p>
      </section>
      <section className="card tfsa-card">
        <div>
          <span className="eyebrow">A CANADIAN ACCOUNT, EXPLAINED</span>
          <h2>TFSA: a container, not a strategy.</h2>
          <p>
            Track your own verified contribution room. Surplus won’t estimate it from your age or
            assume you are eligible. Check your records alongside CRA information; recent activity
            may not yet appear in your CRA account.
          </p>
          <p>
            Withdrawals generally add room back on January 1 of the next calendar year.
            Re-contributing in the same year can cause an excess contribution if you don’t have
            other available room.
          </p>
          <a
            className="text-link"
            href="https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/tax-free-savings-account/withdraw.html"
            target="_blank"
            rel="noreferrer"
          >
            Verify the rules with the CRA <ExternalLink size={14} />
          </a>
        </div>
        <div className="form-stack">
          <Field
            label="My manually verified contribution room"
            hint="Leave blank if you have not verified your room."
          >
            <input
              type="number"
              min="0"
              value={room ?? ''}
              placeholder="Not entered"
              onChange={(e) => setRoom(e.target.value === '' ? null : +e.target.value)}
            />
          </Field>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() =>
              void save(
                { ...w, profile: { ...w.profile, tfsaRoom: room } },
                'Your manually entered room is saved.',
              ).catch(() => {})
            }
          >
            Save my note <Check size={15} />
          </Button>
        </div>
      </section>
    </>
  );
}
