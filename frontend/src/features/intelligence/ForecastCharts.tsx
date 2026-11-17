import { useState } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { cad, prettyDate } from '../../../../shared/finance';
import { chartMoney } from '../../components/chart-format';

export const money = (value: number | null) => (value === null ? 'Not available' : cad(value));
type Point = {
  date: string;
  low: number | null;
  high: number | null;
  median: number | null;
  scenario: number | null;
  constantPrices?: number | null;
};
export function ForecastChart({
  data,
  label,
  goal = false,
  target,
  threshold,
  events = [],
}: {
  data: Point[];
  label: string;
  goal?: boolean;
  target?: number;
  threshold?: number;
  events?: { date: string; label: string; amount: number; direction: string }[];
}) {
  const [period, setPeriod] = useState(goal ? 0 : 30);
  const [range, setRange] = useState(false);
  const [comparison, setComparison] = useState(true);
  const span = data.length
    ? (Date.parse(data.at(-1)!.date) - Date.parse(data[0].date)) / 86400000
    : 0;
  const end = data.length && period ? Date.parse(data[0].date) + period * 86400000 : Infinity;
  const visible = data.filter((p) => Date.parse(p.date) <= end);
  const last = visible.at(-1);
  const first = visible[0];
  const payment =
    !goal && first && last
      ? events
          .filter(
            (event) =>
              event.direction === 'expense' && event.date >= first.date && event.date <= last.date,
          )
          .sort((a, b) => b.amount - a.amount)[0]
      : undefined;
  const lowest = visible
    .filter((p) => p.median !== null)
    .reduce<Point | undefined>((low, p) => (!low || p.median! < low.median! ? p : low), undefined);
  const hasComparison = visible.some(
    (p) => p.median !== null && p.scenario !== null && Math.abs(p.median - p.scenario) > 0.01,
  );
  const hasRange = visible.some((p) => p.low !== null && p.high !== null && p.low !== p.high);
  return (
    <div className="outlook-plot">
      <div className="plot-controls">
        <div className="forecast-segment" role="group" aria-label="Chart time range">
          {([30, 90, 0] as const)
            .filter((days) => days === 0 || days < span)
            .map((days) => (
              <button
                type="button"
                key={days}
                aria-pressed={period === days || (days === 0 && period >= span)}
                onClick={() => setPeriod(days)}
              >
                {days ? `${days} days` : 'Full outlook'}
              </button>
            ))}
        </div>
        <div className="plot-options">
          {hasRange && (
            <label>
              <input type="checkbox" checked={range} onChange={(e) => setRange(e.target.checked)} />{' '}
              Show range
            </label>
          )}
          {hasComparison && (
            <label>
              <input
                type="checkbox"
                checked={comparison}
                onChange={(e) => setComparison(e.target.checked)}
              />{' '}
              Compare my changes
            </label>
          )}
        </div>
      </div>
      <div className="plot-numbers">
        <div>
          <span>{goal ? 'Saved now' : 'Starting balance'}</span>
          <strong>{money(first?.median ?? null)}</strong>
        </div>
        <div>
          <span>{last ? `Estimated · ${prettyDate(last.date)}` : 'Estimated balance'}</span>
          <strong>{money(last?.median ?? null)}</strong>
        </div>
        {!goal && (
          <div>
            <span>Lowest · {lowest ? prettyDate(lowest.date) : '—'}</span>
            <strong
              className={
                lowest && lowest.median! < (threshold ?? 0) ? 'outlook-negative' : undefined
              }
            >
              {money(lowest?.median ?? null)}
            </strong>
          </div>
        )}
      </div>
      <div className="forecast-chart" role="img" aria-label={label}>
        <ResponsiveContainer width="100%" height={270}>
          <ComposedChart
            data={visible.map((p) => ({
              ...p,
              band: p.low === null || p.high === null ? null : [p.low, p.high],
            }))}
            margin={{ top: 18, right: 18, left: 0, bottom: 8 }}
          >
            <CartesianGrid stroke="#e4e8df" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={prettyDate}
              minTickGap={48}
              tick={{ fontSize: 11, fill: '#506149' }}
              padding={{ left: 8, right: 8 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              width={65}
              tickFormatter={chartMoney}
              tick={{ fontSize: 11, fill: '#506149' }}
              axisLine={false}
              tickLine={false}
              domain={
                goal
                  ? [0, (dataMax: number) => Math.max(1, dataMax, target ?? 0) * 1.08]
                  : ['auto', 'auto']
              }
            />
            <Tooltip
              labelFormatter={(value) => prettyDate(String(value))}
              formatter={(value: number | number[], name: string) => [
                Array.isArray(value) ? `${cad(value[0])} – ${cad(value[1])}` : cad(value),
                name,
              ]}
            />
            {payment && (
              <ReferenceLine
                x={payment.date}
                stroke="#899781"
                strokeDasharray="3 4"
                label={{ value: 'Bill', position: 'insideTopRight', fontSize: 11, fill: '#506149' }}
              />
            )}
            {range && (
              <Area
                dataKey="band"
                name="Range of estimates"
                stroke="none"
                fill="#c4d6bb"
                fillOpacity={0.5}
                isAnimationActive={false}
              />
            )}
            {target !== undefined && (
              <ReferenceLine
                y={target}
                stroke="#7c663f"
                strokeDasharray="4 4"
                ifOverflow="extendDomain"
                label={{ value: 'Goal', position: 'insideTopRight', fontSize: 11, fill: '#63502d' }}
              />
            )}
            {!goal && threshold !== undefined && (
              <ReferenceLine
                y={threshold}
                stroke="#a56539"
                strokeDasharray="4 4"
                ifOverflow="extendDomain"
                label={{
                  value: 'Keep aside',
                  position: 'insideTopRight',
                  fontSize: 11,
                  fill: '#80502e',
                }}
              />
            )}
            {!goal && lowest && lowest.median! < 0 && <ReferenceLine y={0} stroke="#9c4937" />}
            <Line
              dataKey="median"
              name={goal ? 'Estimated savings' : 'Estimated balance'}
              stroke="#284f3e"
              dot={false}
              strokeWidth={3}
              isAnimationActive={false}
            />
            {comparison && hasComparison && (
              <Line
                dataKey="scenario"
                name="With your changes"
                stroke="#946015"
                strokeDasharray="6 4"
                dot={false}
                strokeWidth={2.5}
                isAnimationActive={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="plot-legend">
        <span>
          <i /> {goal ? 'Estimated savings' : 'Estimated balance'}
        </span>
        {range && (
          <span>
            <i className="legend-range" /> Range of estimates
          </span>
        )}
        {comparison && hasComparison && (
          <span>
            <i className="legend-change" /> With your changes
          </span>
        )}
        {threshold !== undefined && !goal && <span>Keep aside {cad(threshold)}</span>}
        {target !== undefined && <span>Goal {cad(target)}</span>}
      </div>
      {payment && (
        <div className="plot-payment">
          <span>Largest upcoming bill</span>
          <strong>{payment.label}</strong>
          <span>
            {prettyDate(payment.date)} · {cad(payment.amount)}
          </span>
        </div>
      )}
    </div>
  );
}
export function ForecastMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="forecast-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </div>
  );
}
