import type { LiquidityReport } from '../../../../shared/intelligence';
import { cad, prettyDate } from '../../../../shared/finance';
import { SectionTitle } from '../../components/ui';
import { ForecastMetric, money } from './ForecastCharts';

export function LiquidityPanel({ report }: { report: LiquidityReport }) {
  const fortnight = report.horizons.find((h) => h.days === 14);
  return (
    <section className="card liquidity-panel">
      <SectionTitle title="Your next two weeks" />
      <div className="forecast-metrics">
        <ForecastMetric
          label="Lowest estimated balance"
          value={money(fortnight?.minimumMedian ?? null)}
          detail={
            fortnight?.firstPressureDate
              ? `Below your cushion from ${prettyDate(fortnight.firstPressureDate)}`
              : undefined
          }
        />
        <ForecastMetric
          label="Could set aside once"
          value={money(report.safeToSetAside)}
          detail="Personal money after funding reserves, bills, goals and your cushion"
        />
        <ForecastMetric
          label="Next expected income"
          value={report.nextIncome ? cad(report.nextIncome.amount) : 'None scheduled'}
          detail={report.nextIncome ? prettyDate(report.nextIncome.date) : undefined}
        />
      </div>
      {report.status === 'stale' && (
        <p className="field-note">Update your bank balance before setting money aside.</p>
      )}
      <details className="forecast-details">
        <summary>Risk estimates & assumptions</summary>
        {report.horizons.map((h) => (
          <div className="liquidity-window" key={h.days}>
            <h3>Next {h.days} days</h3>
            <div className="forecast-pair">
              <span>Simulations below your cushion</span>
              <strong>
                {h.bufferBreachShare === null ? 'Not scored' : `${h.bufferBreachShare}%`}
              </strong>
            </div>
            <div className="forecast-pair">
              <span>Simulations below zero</span>
              <strong>{h.negativeShare === null ? 'Not scored' : `${h.negativeShare}%`}</strong>
            </div>
          </div>
        ))}
        <p>
          Simulated outcomes, not personal odds. Protected balance: {cad(report.protectedBalance)}.
        </p>
        {report.notes.map((note) => (
          <p key={note}>{note}</p>
        ))}
      </details>
    </section>
  );
}
