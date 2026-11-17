import { useEffect, useState } from 'react';
import type { ForecastReport } from '../../../../shared/intelligence';
import type { AppState } from '../../../../shared/schema';
import { cad, prettyDate } from '../../../../shared/finance';
import { api, useApp } from '../../lib';
import { Badge, Button, SectionTitle } from '../../components/ui';
import { ForecastMetric } from './ForecastCharts';

export function WeeklyActionPlan({
  report,
  onReview,
}: {
  report: ForecastReport;
  onReview: () => void;
}) {
  const { w, state, save: saveWorkspace, demo, refresh, notify, navigate } = useApp();
  const save = async (next: typeof w, message?: string) => {
    try {
      await saveWorkspace(next, message);
      return true;
    } catch {
      return false;
    }
  };
  const [syncing, setSyncing] = useState(false),
    [trial, setTrial] = useState(false);
  const [preferences, setPreferences] = useState(
    w.intelligenceSettings || { autoSync: false, alerts: true, dismissed: [] },
  );
  const [savingPreferences, setSavingPreferences] = useState(false);
  useEffect(() => {
    setPreferences(w.intelligenceSettings || { autoSync: false, alerts: true, dismissed: [] });
  }, [w.intelligenceSettings]);
  const changePreferences = async (next: typeof preferences) => {
    const previous = preferences;
    setPreferences(next);
    setSavingPreferences(true);
    if (!(await save({ ...w, intelligenceSettings: next }))) setPreferences(previous);
    setSavingPreferences(false);
  };
  useEffect(() => {
    let active = true;
    if (!demo && w.source === 'live')
      void api<{ trialFeatures: boolean }>('/plaid/status')
        .then((r) => {
          if (active) setTrial(r.trialFeatures);
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [demo, w.source]);
  useEffect(() => {
    if (demo || !preferences.autoSync || w.source !== 'live') return;
    let active = true;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible')
        void api<AppState>('/state')
          .then((next) => {
            if (active && JSON.stringify(next) !== JSON.stringify(state)) refresh(next);
          })
          .catch(() => {});
    }, 60000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [demo, preferences.autoSync, w.source, state, refresh]);
  const sync = async (kind?: 'transactions' | 'balance') => {
    setSyncing(true);
    try {
      refresh(
        await api<AppState>(
          kind ? '/plaid/trial-refresh' : '/plaid/sync',
          'POST',
          kind ? { kind } : {},
        ),
      );
      notify(
        kind === 'transactions'
          ? 'Bank refresh requested. Plaid may need time; sync again after it finishes.'
          : 'Bank information updated. Rebuilding your outlook.',
      );
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setSyncing(false);
    }
  };
  const plan = report.weeklyPlan;
  if (!plan) return null;
  return (
    <section className="card weekly-action-plan">
      <SectionTitle
        title="Your next seven days"
        subtitle={`Through ${prettyDate(plan.endDate)}`}
        action={
          <Badge>
            {report.syncedAt
              ? `Synced ${prettyDate(report.syncedAt.slice(0, 10))}`
              : 'Saved snapshot'}
          </Badge>
        }
      />
      {preferences.alerts && (
        <div className="weekly-actions">
          {plan.actions
            .filter((a) => a.priority === 'high' && !preferences.dismissed.includes(a.id))
            .map((a) => (
              <article key={a.id}>
                <Badge tone={a.priority === 'high' ? 'amber' : 'green'}>
                  {a.priority === 'high' ? 'Needs attention' : 'Worth a look'}
                </Badge>
                <h3>{a.title}</h3>
                <details className="forecast-details">
                  <summary>Why this matters</summary>
                  <p>{a.detail}</p>
                </details>
                <div className="button-row">
                  <Button
                    variant="secondary"
                    disabled={syncing}
                    onClick={() =>
                      a.page === 'sync' && w.source === 'live'
                        ? void sync()
                        : a.page === 'review'
                          ? onReview()
                          : navigate(a.page === 'sync' ? 'settings' : a.page)
                    }
                  >
                    {a.page === 'review'
                      ? 'Review transactions'
                      : a.page === 'sync'
                        ? 'Update bank information'
                        : a.page === 'goals'
                          ? 'Review my goals'
                          : a.page === 'semester'
                            ? 'Check my plan'
                            : 'View details'}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() =>
                      void save({
                        ...w,
                        intelligenceSettings: {
                          ...preferences,
                          dismissed: [...preferences.dismissed, a.id].slice(-100),
                        },
                      })
                    }
                  >
                    Dismiss
                  </Button>
                </div>
              </article>
            ))}
        </div>
      )}
      <div className="outlook-upcoming">
        <h3>Coming in & going out</h3>
        {plan.upcoming.slice(0, 4).map((e, i) => (
          <div className="outlook-payment" key={`${e.date}-${i}`}>
            <span className="outlook-payment-date">{prettyDate(e.date)}</span>
            <span>
              <strong>{e.label}</strong>
              <small>{e.origin}</small>
            </span>
            <strong className={e.direction === 'income' ? 'positive' : undefined}>
              {e.direction === 'income' ? '+' : '−'}
              {cad(e.amount)}
            </strong>
          </div>
        ))}
        {!plan.upcoming.length && (
          <p>
            No payments are scheduled for this week. Add any missing bills or pay dates to your
            semester plan.
          </p>
        )}
        {plan.upcoming.length > 4 && (
          <details className="forecast-details">
            <summary>See all {plan.upcoming.length} upcoming payments</summary>
            {plan.upcoming.slice(4).map((e, i) => (
              <div className="forecast-pair" key={i}>
                <span>
                  {e.label}
                  <small>{prettyDate(e.date)}</small>
                </span>
                <strong>
                  {e.direction === 'income' ? '+' : '−'}
                  {cad(e.amount)}
                </strong>
              </div>
            ))}
          </details>
        )}
      </div>
      <details className="forecast-details">
        <summary>This week’s spending estimate</summary>
        <div className="forecast-metrics">
          <ForecastMetric
            label="Everyday spending"
            value={cad(plan.variableSpending)}
            detail="An estimate based on your usual spending"
          />
          <ForecastMetric
            label="Scheduled bills"
            value={cad(plan.scheduledBills)}
            detail="Planned and detected payments"
          />
          <ForecastMetric
            label="Expected income"
            value={cad(plan.scheduledIncome)}
            detail="Known plan and detected pay dates"
          />
        </div>
        <p className="weekly-room">
          <strong>{plan.extraRoom === null ? 'More data needed' : cad(plan.extraRoom)}</strong>{' '}
          optional extra room beyond your current plan
        </p>
        <p className="field-note">{plan.note}</p>
      </details>
      <details className="forecast-details">
        <summary>Reminders & bank updates</summary>
        <label className="checkbox-line">
          <input
            type="checkbox"
            disabled={savingPreferences}
            checked={preferences.alerts}
            onChange={(e) => void changePreferences({ ...preferences, alerts: e.target.checked })}
          />
          Show in-app action reminders
        </label>
        {!!preferences.dismissed.length && (
          <Button
            variant="ghost"
            onClick={() =>
              void save({ ...w, intelligenceSettings: { ...preferences, dismissed: [] } })
            }
          >
            Restore dismissed reminders
          </Button>
        )}
        <label className="checkbox-line">
          <input
            type="checkbox"
            disabled={demo || w.source !== 'live' || savingPreferences}
            checked={preferences.autoSync}
            onChange={(e) => void changePreferences({ ...preferences, autoSync: e.target.checked })}
          />
          Automatically sync my connected bank every six hours
        </label>
        <p className="field-note">
          Automatic sync runs while the Surplus backend is running. It retrieves available Plaid
          updates; it does not force the bank to refresh. Reminders appear inside the app.
        </p>
        <div className="button-row">
          <Button
            variant="secondary"
            disabled={syncing || demo || !['live', 'sandbox'].includes(w.source)}
            onClick={() => void sync()}
          >
            Sync bank & update outlook
          </Button>
          {trial && (
            <>
              <Button variant="ghost" disabled={syncing} onClick={() => void sync('balance')}>
                Check current balance · Trial
              </Button>
              <Button variant="ghost" disabled={syncing} onClick={() => void sync('transactions')}>
                Request bank refresh · Trial
              </Button>
            </>
          )}
        </div>
        {w.source === 'live' && !trial && (
          <p className="field-note">
            Additional Balance and bank-refresh calls are off until the server's Trial plan
            confirmation is current. Normal sync remains available.
          </p>
        )}
      </details>
    </section>
  );
}
