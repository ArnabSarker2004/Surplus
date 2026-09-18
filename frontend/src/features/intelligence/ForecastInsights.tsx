import type { ForecastReport } from '../../../../shared/intelligence';
import { cad } from '../../../../shared/finance';
import { Badge, SectionTitle } from '../../components/ui';

export function ModelStatus({ report }: { report: ForecastReport }) {
  return (
    <>
      <section className="card intelligence-model-status">
        <div>
          <Badge tone="green">Python forecasting engine</Badge>
          <h2>Your patterns, tested before they are projected.</h2>
          <p>
            {report.models.some((m) => m.selected !== 'Recent average')
              ? 'A learned model improved on the baseline in chronological testing.'
              : 'Using a recent-average baseline. Ridge regression is evaluated from 16 complete weeks and gradient boosting from 30; each must improve on the baseline to be selected.'}
          </p>
        </div>
        <div className="intelligence-model-chips">
          {report.models.map((model) => (
            <div key={model.series}>
              <span>{model.series}</span>
              <strong>{model.selected}</strong>
              <small>
                {model.trainingWeeks} complete weeks ·{' '}
                {model.mae === null
                  ? 'Accuracy not yet measurable'
                  : `${cad(model.mae)} weekly holdout error`}
              </small>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

export function ForecastInsights({ report }: { report: ForecastReport }) {
  const categories = report.categories.slice(0, 6);
  const max = Math.max(1, ...categories.flatMap((c) => [c.last30, c.previous30]));
  return (
    <div className="intelligence-cards intelligence-section">
      <section className="card">
        <SectionTitle
          title="Where your habits are shifting"
          subtitle="Last 30 days compared with the previous 30. Fewer than 60 observed days can leave an incomplete comparison."
        />
        {categories.length ? (
          categories.map((row) => (
            <div className="spending-comparison" key={row.category}>
              <div>
                <strong>{row.category}</strong>
                <span>{cad(row.last30)}</span>
              </div>
              <div className="spending-track" aria-hidden="true">
                <i style={{ width: `${(Math.max(0, row.last30) / max) * 100}%` }} />
              </div>
              <p>
                Previously {cad(row.previous30)} ·{' '}
                {row.changePercent === null
                  ? 'No percentage comparison'
                  : `${row.changePercent > 0 ? '+' : ''}${row.changePercent}%`}
              </p>
            </div>
          ))
        ) : (
          <p>Categorized spending will appear here after you sync transactions.</p>
        )}
      </section>
      <section className="card">
        <SectionTitle
          title="What is coming up"
          subtitle="The next scheduled or detected events included in this forecast."
        />
        {report.upcoming.slice(0, 8).map((event, i) => (
          <div className="intelligence-list-item" key={`${event.date}-${i}`}>
            <div>
              <strong>{event.label}</strong>
              <p>
                {event.date} · {event.origin}
              </p>
            </div>
            <strong>
              {event.direction === 'income' ? '+' : '−'}
              {cad(event.amount)}
            </strong>
          </div>
        ))}
        {!report.upcoming.length && (
          <p>Add known bills and income to your semester plan for more precise dates.</p>
        )}
      </section>
    </div>
  );
}
