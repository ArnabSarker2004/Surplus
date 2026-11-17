import { ArrowRight, PiggyBank, Target } from 'lucide-react';
import type { ForecastReport } from '../../../../shared/intelligence';
import { cad, prettyDate } from '../../../../shared/finance';
import { Button } from '../../components/ui';
import { money } from './ForecastCharts';

export function OutlookSummary({
  report,
  onCash,
  onGoals,
  onConnect,
}: {
  report: ForecastReport;
  onCash: () => void;
  onGoals: () => void;
  onConnect: () => void;
}) {
  const { summary, liquidity, quality } = report;
  const pressure = liquidity.horizons.find((h) => h.days === 14)?.firstPressureDate;
  const ready = quality.cashKnown && liquidity.status === 'available';
  const day30 = report.timeline[Math.min(30, report.timeline.length - 1)];
  return (
    <>
      {!quality.cashKnown && (
        <div className="outlook-attention">
          <div>
            <strong>Start with your balance</strong>
            <span>Connect an account or enter your current cash.</span>
          </div>
          <Button variant="secondary" onClick={onConnect}>
            Add a balance
          </Button>
        </div>
      )}
      <section className="outlook-at-glance" aria-label="Your next 30 days">
        <div className="glance-balance">
          <span>Balance in 30 days</span>
          <strong>{money(day30?.median ?? null)}</strong>
          <small>{day30 ? prettyDate(day30.date) : 'Add your cash balance'}</small>
          <button type="button" onClick={onCash}>
            View cash flow <ArrowRight size={15} />
          </button>
        </div>
        <div>
          <span>Expected in</span>
          <strong>{cad(summary.incomeNext30)}</strong>
          <small>Next 30 days</small>
        </div>
        <div>
          <span>Expected out</span>
          <strong>{cad(summary.spendingNext30)}</strong>
          <small>Next 30 days</small>
        </div>
        <div>
          <span>Net change</span>
          <strong className={summary.netNext30 < 0 ? 'outlook-negative' : undefined}>
            {summary.netNext30 > 0 ? '+' : ''}
            {cad(summary.netNext30)}
          </strong>
          <small>Next 30 days</small>
        </div>
      </section>
      {pressure && ready && (
        <div className="outlook-attention">
          <div>
            <strong>Balance may dip on {prettyDate(pressure)}</strong>
            <span>Below your {cad(liquidity.protectedBalance)} cushion and saved goals.</span>
          </div>
          <Button variant="secondary" onClick={onCash}>
            See the dip <ArrowRight size={16} />
          </Button>
        </div>
      )}
      {liquidity.status === 'stale' && (
        <div className="outlook-attention">
          <div>
            <strong>Update your bank balance</strong>
            <span>Your last bank update is over three days old.</span>
          </div>
          <Button variant="secondary" onClick={onConnect}>
            Update bank
          </Button>
        </div>
      )}
      <div className="outlook-shortcuts">
        <button
          type="button"
          className="outlook-shortcut"
          onClick={onCash}
          aria-label="Could I set money aside?"
        >
          <PiggyBank size={22} />
          <span>
            <strong>{ready ? money(liquidity.safeToSetAside) : '—'} to set aside</strong>
            <span>One-time estimate · bills and cushion covered</span>
          </span>
          <ArrowRight size={18} />
        </button>
        <button type="button" className="outlook-shortcut" onClick={onGoals}>
          <Target size={22} />
          <span>
            <strong>My savings goals</strong>
            <span>
              {report.goals.length
                ? `${report.goals.length} goals · view progress`
                : 'Add a goal to get started'}
            </span>
          </span>
          <ArrowRight size={18} />
        </button>
      </div>
    </>
  );
}
