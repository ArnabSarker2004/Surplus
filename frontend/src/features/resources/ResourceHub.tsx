import {
  ArrowUpRight,
  Bookmark,
  BriefcaseBusiness,
  CalendarDays,
  Compass,
  Search,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  resourceKinds,
  resourceStatus,
  torontoToday,
  type ResourceCatalog,
  type StudentResource,
} from '../../../../shared/resources';
import { Button, Empty, Field } from '../../components/ui';
import { api, useApp } from '../../lib';
import { ResourceCard } from './ResourceCard';
import { ResourceDetail } from './ResourceDetail';

export type ResourceView = 'Discover TMU' | 'My shortlist' | 'TMU zones';
export function ResourceHub({
  view,
  onView,
}: {
  view: ResourceView;
  onView: (view: ResourceView) => void;
}) {
  const { w, save, busy } = useApp();
  const [catalog, setCatalog] = useState<ResourceCatalog | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState('All types');
  const [paid, setPaid] = useState(false);
  const [showClosed, setShowClosed] = useState(false);
  const [sort, setSort] = useState('Featured');
  const [limit, setLimit] = useState(9);
  const [detail, setDetail] = useState<StudentResource | null>(null);
  useEffect(() => {
    let cancelled = false;
    setError('');
    void api<ResourceCatalog>('/resources')
      .then((data) => {
        if (!cancelled) setCatalog(data);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [retry]);
  useEffect(() => {
    setLimit(9);
  }, [view, search, kind, paid, showClosed, sort]);
  useEffect(() => {
    setKind('All types');
    setSearch('');
    setPaid(false);
  }, [view]);
  if (error)
    return (
      <Empty
        title="We couldn’t load the resource directory"
        detail={error}
        action={<Button onClick={() => setRetry(retry + 1)}>Try again</Button>}
      />
    );
  if (!catalog) return <p role="status">Loading TMU resources…</p>;
  const resources = catalog.resources;
  const progress = w.resourceProgress ?? {};
  const today = torontoToday();
  const due = resources.filter(
    (r) =>
      progress[r.id]?.followUp &&
      progress[r.id].followUp! <= today &&
      !['Completed', 'Not pursuing'].includes(progress[r.id].stage),
  );
  const filtered = resources
    .filter((r) => {
      const status = resourceStatus(r);
      return (
        (view === 'TMU zones'
          ? r.kind === 'Zones'
          : view === 'My shortlist'
            ? !!progress[r.id]
            : r.kind !== 'Zones') &&
        (kind === 'All types' || r.kind === kind) &&
        (!paid || r.benefit.type !== 'support') &&
        (view === 'My shortlist' ||
          showClosed ||
          !['Closed', 'Past event', 'Deadline passed'].includes(status)) &&
        `${r.title} ${r.provider} ${r.summary} ${r.tags.join(' ')} ${r.contact?.email ?? ''}`
          .toLowerCase()
          .includes(search.toLowerCase())
      );
    })
    .sort((a, b) =>
      sort === 'A–Z'
        ? a.title.localeCompare(b.title)
        : sort === 'Upcoming dates'
          ? (a.event?.start.slice(0, 10) ?? a.deadline ?? '9999').localeCompare(
              b.event?.start.slice(0, 10) ?? b.deadline ?? '9999',
            )
          : 0,
    );
  const toggleSave = async (r: StudentResource) => {
    const next = { ...progress };
    if (next[r.id]) delete next[r.id];
    else next[r.id] = { stage: 'Saved', notes: '', followUp: null };
    try {
      await save(
        { ...w, resourceProgress: next },
        next[r.id] ? 'Added to your resource shortlist.' : 'Removed from your resource shortlist.',
      );
    } catch {
      /* App displays error. */
    }
  };
  const quickFilter = (type: string, fundingOnly: boolean) => {
    setKind(type);
    setPaid(fundingOnly);
    setSearch('');
  };
  return (
    <div className="resource-hub">
      <section className="resource-hero">
        <div>
          <span className="resource-eyebrow">A SMALL STEP, A REAL CONNECTION</span>
          <h2>There’s more within reach.</h2>
          <p>
            Paid projects, campus work, helpful people. Start with one resource and a clear next
            step.
          </p>
        </div>
        <div className="resource-hero-stats">
          <strong>{resources.length}</strong>
          <span>researched resources</span>
          <button onClick={() => onView('TMU zones')}>
            Explore all 10 Zones <ArrowUpRight size={15} />
          </button>
        </div>
      </section>
      {view === 'Discover TMU' && (
        <div className="resource-pathways" aria-label="Quick resource filters">
          <button onClick={() => quickFilter('Campus jobs', false)}>
            <BriefcaseBusiness size={20} />
            <span>
              Find campus work<small>Roles & application routes</small>
            </span>
          </button>
          <button onClick={() => quickFilter('All types', true)}>
            <Compass size={20} />
            <span>
              Explore funding<small>Stipends, jobs & awards</small>
            </span>
          </button>
          <button onClick={() => quickFilter('Events', false)}>
            <CalendarDays size={20} />
            <span>
              Meet & learn<small>Events & career connections</small>
            </span>
          </button>
        </div>
      )}
      <p className="resource-disclosure">
        Official sources, reviewed {catalog.reviewedAt}. Availability can change; automatic
        monitoring is not enabled. Amounts are in CAD and are not guaranteed income.
      </p>
      {due.length > 0 && (
        <aside className="resource-followups">
          <Bookmark size={18} />
          <div>
            <strong>
              {due.length} follow-up{due.length === 1 ? '' : 's'} due
            </strong>
            {due.map((r) => (
              <button key={r.id} onClick={() => setDetail(r)}>
                {r.title} · {progress[r.id].followUp}
              </button>
            ))}
          </div>
        </aside>
      )}
      {view === 'TMU zones' && (
        <p className="resource-view-note">
          Explore each Zone’s focus and contact its team about student participation. A Zone listing
          does not mean a paid position is currently available.
        </p>
      )}
      {view === 'My shortlist' && (
        <p className="resource-view-note">
          Your saved resources, application progress and follow-ups. Open a resource to update your
          notes.
        </p>
      )}
      <div className="resource-filters">
        <div className="search-field">
          <Search size={17} />
          <input
            aria-label="Search TMU resources"
            placeholder="Try design, international, mentoring…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {view !== 'TMU zones' && (
          <Field label="Resource type">
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option>All types</option>
              {resourceKinds
                .filter((k) => view === 'My shortlist' || k !== 'Zones')
                .map((k) => (
                  <option key={k}>{k}</option>
                ))}
            </select>
          </Field>
        )}
        <Field label="Sort resources">
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            {['Featured', 'Upcoming dates', 'A–Z'].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
      </div>
      <div className="resource-filter-options">
        {view !== 'TMU zones' && (
          <label>
            <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} />{' '}
            Paid work & funding only
          </label>
        )}
        {view !== 'My shortlist' && (
          <label>
            <input
              type="checkbox"
              checked={showClosed}
              onChange={(e) => setShowClosed(e.target.checked)}
            />{' '}
            Include closed & past listings
          </label>
        )}
        <span role="status">
          {filtered.length} resource{filtered.length === 1 ? '' : 's'}
        </span>
      </div>
      <div className="resource-grid">
        {filtered.slice(0, limit).map((r) => (
          <ResourceCard
            key={r.id}
            resource={r}
            progress={progress[r.id]}
            busy={busy}
            onSave={() => void toggleSave(r)}
            onDetails={() => setDetail(r)}
          />
        ))}
      </div>
      {!filtered.length && (
        <Empty
          title={
            view === 'My shortlist'
              ? 'Your next step starts here'
              : 'No resources match these filters'
          }
          detail={
            view === 'My shortlist'
              ? 'Save a resource from Discover TMU or TMU zones, then keep notes and follow-up dates here.'
              : 'Try another search or include closed listings to explore future possibilities.'
          }
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setSearch('');
                setKind('All types');
                setPaid(false);
                if (view === 'My shortlist') onView('Discover TMU');
              }}
            >
              Explore resources
            </Button>
          }
        />
      )}
      {filtered.length > limit && (
        <Button
          variant="secondary"
          className="resource-show-more"
          onClick={() => setLimit(limit + 9)}
        >
          Show more resources ({filtered.length - limit} remaining)
        </Button>
      )}
      <footer className="resource-directory-links">
        <a
          href="https://www.torontomu.ca/zone-learning/zones/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Official Zone directory ↗
        </a>
        <a
          href="https://www.torontomu.ca/zone-learning/initiatives/"
          target="_blank"
          rel="noopener noreferrer"
        >
          All Zone initiatives ↗
        </a>
        <a href="https://zonestmu.activehosted.com/f/1" target="_blank" rel="noopener noreferrer">
          Zone Learning newsletter ↗
        </a>
      </footer>
      {detail && <ResourceDetail resource={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}
