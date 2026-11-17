import type { ForecastReport } from '../../../../shared/intelligence';
import { cad } from '../../../../shared/finance';
import { Badge, SectionTitle } from '../../components/ui';
import { useApp } from '../../lib';

export function ForecastAccuracy({ report }: { report: ForecastReport }) {
  const e = report.evaluation;
  return (
    <section className="card">
      <SectionTitle
        title="How forecasts compare with reality"
        subtitle="Predictions are saved before their outcome is known. Missing observations are left unscored."
        action={
          <Badge>
            {e?.status === 'available' ? 'Observed comparisons' : 'Collecting evidence'}
          </Badge>
        }
      />
      <div className="forecast-metrics">
        {[7, 30, 90].map((days) => {
          const c = e?.checkpoints.find((c) => c.days === days);
          return (
            <div key={days}>
              <span>{days}-day forecasts</span>
              <strong>{c?.count ? cad(c.mae!) : 'Not scored yet'}</strong>
              <small>
                {c?.count
                  ? `${c.count} comparisons · average absolute error`
                  : `Needs a saved prediction and a synced snapshot ${days} days later`}
              </small>
              {!!c?.count && (
                <small>{c.coverage}% of observed balances were within the simulated range</small>
              )}
            </div>
          );
        })}
      </div>
      <p className="field-note">
        {e?.note ||
          'Live accuracy is collected for your bank-connected account. Demo results are fictional and do not establish forecasting accuracy.'}
      </p>
      {!!e?.latest.length && (
        <details className="forecast-details">
          <summary>Recent comparisons</summary>
          {e.latest.map((r, i) => (
            <div className="forecast-pair" key={i}>
              <span>
                {r.days} days · {r.predictedOn} → {r.observedOn}
                <small>
                  Predicted {cad(r.predicted)} · Observed {cad(r.actual)}
                </small>
              </span>
              <strong>
                {r.error >= 0 ? '+' : '−'}
                {cad(Math.abs(r.error))}
              </strong>
            </div>
          ))}
        </details>
      )}
    </section>
  );
}
export function AccountForecasts({ report }: { report: ForecastReport }) {
  const { state } = useApp();
  if (!report.accountOutlooks?.accounts.length) return null;
  return (
    <section className="card">
      <SectionTitle
        title="Each account has its own bills"
        subtitle="A 14-day view of known payments and recent variable outflows. Assign bills and pay below to improve it."
      />
      <div className="forecast-grid">
        {report.accountOutlooks.accounts.map((a) => (
          <article className="liquidity-window" key={a.accountId}>
            <Badge tone={a.status === 'partial' ? 'amber' : 'neutral'}>
              {a.status === 'partial' ? 'Partial estimate' : 'Known-payment estimate'}
            </Badge>
            <h3>{state.accounts.find((b) => b.id === a.accountId)?.name || 'Cash account'}</h3>
            <div className="forecast-pair">
              <span>Lowest projected balance</span>
              <strong>{cad(a.minimum)}</strong>
            </div>
            <p>
              {a.firstNegativeDate
                ? `Below zero on this path: ${a.firstNegativeDate}.`
                : 'No negative balance on this path.'}
            </p>
            {!!a.unassignedPayments && (
              <p>{a.unassignedPayments} upcoming payments have no cash-account assignment.</p>
            )}
          </article>
        ))}
      </div>
      <p className="field-note">{report.accountOutlooks.note}</p>
    </section>
  );
}
