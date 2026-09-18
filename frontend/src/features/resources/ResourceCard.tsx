import { ArrowUpRight, Bookmark, BookmarkCheck, CalendarDays, Clock3 } from 'lucide-react';
import {
  needsResourceReview,
  resourceStatus,
  type ResourceProgress,
  type StudentResource,
} from '../../../../shared/resources';
import { Badge, Button } from '../../components/ui';

export function ResourceCard({
  resource: r,
  progress,
  busy,
  onSave,
  onDetails,
}: {
  resource: StudentResource;
  progress?: ResourceProgress;
  busy: boolean;
  onSave: () => void;
  onDetails: () => void;
}) {
  const status = resourceStatus(r);
  const closed = ['Closed', 'Past event', 'Deadline passed'].includes(status);
  return (
    <article
      className={`card resource-card ${closed ? 'resource-closed' : ''}`}
      aria-label={r.title}
    >
      <div className="resource-card-top">
        <span className="resource-kind">{r.kind}</span>
        <button
          className="icon-button"
          disabled={busy}
          onClick={onSave}
          aria-label={`${progress ? 'Unsave' : 'Save'} ${r.title}`}
          aria-pressed={!!progress}
        >
          {progress ? <BookmarkCheck size={19} /> : <Bookmark size={19} />}
        </button>
      </div>
      <h2>{r.title}</h2>
      <p className="resource-provider">{r.provider}</p>
      <p className="resource-summary">{r.summary}</p>
      <div className="resource-benefit">
        <strong>{r.benefit.label}</strong>
        <span>
          {r.benefit.type === 'support' ? 'Learning & support' : 'Published in CAD · confirm terms'}
        </span>
      </div>
      <div className="resource-labels">
        <Badge tone={closed || status === 'Waitlist' ? 'amber' : 'neutral'}>{status}</Badge>
        {progress && <Badge tone="green">{progress.stage}</Badge>}
        {needsResourceReview(r) && <Badge tone="amber">Needs recheck</Badge>}
      </div>
      <p className="resource-timing">
        <CalendarDays size={15} aria-hidden="true" />
        <span>{r.timing}</span>
      </p>
      {r.commitment !== 'Confirm with the provider' && (
        <p className="resource-timing">
          <Clock3 size={15} aria-hidden="true" />
          <span>{r.commitment}</span>
        </p>
      )}
      <div className="resource-card-actions">
        <Button variant="secondary" onClick={onDetails}>
          Details & contact
        </Button>
        <a
          href={r.action.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${r.action.label}: ${r.title} (opens in new tab)`}
        >
          Official page <ArrowUpRight size={16} />
        </a>
      </div>
      <small className="resource-reviewed">
        Source reviewed {r.checkedAt}
        {r.action.login ? ' · TMU sign-in required' : ''}
      </small>
    </article>
  );
}
