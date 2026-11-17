import type { EconomyReport } from '../../../../shared/economy';
import { cad } from '../../../../shared/finance';
import { Badge, SectionTitle } from '../../components/ui';
import { ForecastMetric } from './ForecastCharts';

export function EconomyPanel({ report }: { report: EconomyReport }) {
  return (
    <section className="card economy-panel">
      <SectionTitle
        title="What could rising prices change?"
        subtitle="See how inflation could affect everyday spending. Your saved bills and goal amounts stay the same."
        action={
          <Badge tone={report.status === 'unavailable' ? 'amber' : 'green'}>
            {report.mode === 'off'
              ? 'Price adjustment off'
              : report.status === 'unavailable'
                ? 'CPI unavailable'
                : report.mode === 'custom'
                  ? 'Your assumption'
                  : `${report.region} · ${report.period?.slice(0, 7)}`}
          </Badge>
        }
      />
      <div className="forecast-metrics">
        <ForecastMetric
          label="Yearly price change for your spending mix"
          value={
            report.weightedAnnualRate === null
              ? 'No adjustment'
              : `${report.weightedAnnualRate.toFixed(1)}%`
          }
          detail="Used to estimate changes in everyday spending"
        />
        <ForecastMetric
          label="Next 30 days · price effect"
          value={cad(report.extraCostNext30)}
          detail="Extra cost compared with prices staying the same"
        />
        <ForecastMetric
          label="Full forecast · price effect"
          value={cad(report.extraCost)}
          detail="Median modeled difference"
        />
      </div>
      {report.categories.length > 0 && (
        <details className="forecast-details">
          <summary>Category baselines & price assumptions</summary>
          <div className="forecast-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Monthly baseline</th>
                  <th>Annual rate</th>
                  <th>In 12 months*</th>
                </tr>
              </thead>
              <tbody>
                {report.categories.map((c) => (
                  <tr key={c.category}>
                    <th scope="row">
                      {c.category}
                      <small>{c.sourceLabel}</small>
                    </th>
                    <td>{cad(c.monthlySpend)}</td>
                    <td>{c.annualRate.toFixed(1)}%</td>
                    <td>{cad(c.monthlySpend * (1 + c.annualRate / 100))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            *Same quantities and habits, carrying this annual rate forward for a year. This is a
            planning baseline; saved budget limits are unchanged.
          </p>
        </details>
      )}
      <details className="forecast-details">
        <summary>Source & assumptions</summary>
        {report.notes.map((note) => (
          <p key={note}>{note}</p>
        ))}
        <p>
          <a href={report.sourceUrl} target="_blank" rel="noreferrer">
            Statistics Canada · monthly CPI, table 18-10-0004-01
          </a>
          {report.fetchedAt && ` · Retrieved ${new Date(report.fetchedAt).toLocaleDateString()}`}
        </p>
        <p>
          Published CPI is monthly, not a real-time price feed.{' '}
          {report.status === 'cached'
            ? 'A cached release is being used because a fresh request was unavailable.'
            : ''}
        </p>
      </details>
    </section>
  );
}
