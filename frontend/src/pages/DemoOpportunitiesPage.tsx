import { ArrowRight, Clock3, Compass, GraduationCap, Leaf, MapPin, Search } from 'lucide-react';
import { useState } from 'react';
import { asOf, cad, matchOpportunity, plan, prettyDate } from '../../../shared/finance';
import { statuses, type OpportunityStatus } from '../../../shared/schema';
import { Badge, Button, CheckList, Empty, Field } from '../components/ui';
import { useApp } from '../lib';

export function DemoOpportunitiesPage() {
  const { w, state, save, busy, navigate } = useApp();
  const [filter, setFilter] = useState('All opportunities');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const p = plan(w, state.opportunities);
  const matches = state.opportunities
    .map((o) => ({
      ...o,
      match: matchOpportunity(o, w.profile, asOf(w)),
      status: w.applications[o.id] ?? 'Recommended',
    }))
    .sort(
      (a, b) =>
        Number(b.match.eligible) - Number(a.match.eligible) || b.match.score - a.match.score,
    );
  const visible = matches.filter(
    (o) =>
      (filter === 'All opportunities' ||
        (filter === 'Good fits' && o.match.eligible) ||
        (filter === 'My shortlist' && ['Saved', 'Applying', 'Applied'].includes(o.status)) ||
        (filter === 'Awarded' && o.status === 'Awarded')) &&
      `${o.title} ${o.provider} ${o.type}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <div className="opportunity-intro">
        <span className="intro-asterisk">✳</span>
        <div>
          <h2>Sometimes, the next step is closer than you think.</h2>
          <p>Projects, bursaries, and campus experiences, connected to your semester plan.</p>
        </div>
        <div>
          <strong>{cad(p.potential)}</strong>
          <span>potential in your shortlist</span>
        </div>
      </div>
      <p className="sample-disclosure">
        <InfoIcon /> All listings below are fictional examples, not active TMU postings. Amounts,
        dates, and eligibility illustrate the experience. Acceptance is never guaranteed.
      </p>
      <div className="hub-toolbar">
        <div className="tabs" role="group" aria-label="Filter opportunities">
          {['All opportunities', 'Good fits', 'My shortlist', 'Awarded'].map((f) => (
            <button key={f} className={filter === f ? 'selected' : ''} onClick={() => setFilter(f)}>
              {f}
            </button>
          ))}
        </div>
        <div className="search-field">
          <Search size={17} />
          <input
            aria-label="Search opportunities"
            placeholder="Find a possibility"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      <div className="opportunity-grid">
        {visible.map((o, i) => (
          <section className={`card opportunity-card opportunity-color-${i % 3}`} key={o.id}>
            <div className="opportunity-card-top">
              <span className="opportunity-symbol">
                {o.type === 'Bursaries' ? (
                  <GraduationCap size={26} />
                ) : o.type === 'Learning Zone stipends' ? (
                  <Compass size={26} />
                ) : (
                  <Leaf size={26} />
                )}
              </span>
              <div>
                <Badge tone={o.match.eligible ? 'green' : 'amber'}>
                  {o.match.eligible ? `${o.match.score}% profile match` : 'Check eligibility'}
                </Badge>
                <Badge>Sample</Badge>
              </div>
            </div>
            <small className="opportunity-type">{o.type}</small>
            <h2>{o.title}</h2>
            <p className="provider">{o.provider}</p>
            <p>{o.description}</p>
            <div className="opportunity-meta">
              <span>
                <Clock3 size={14} />
                {o.hours} hrs/week · {o.duration}
              </span>
              <span>
                <MapPin size={14} />
                {o.location}
              </span>
            </div>
            <div className="opportunity-money">
              <strong>{cad(o.amount)}</strong>
              <span>
                Sample deadline
                <br />
                <b>{prettyDate(o.deadline)}</b>
              </span>
            </div>
            <button
              className="text-link"
              onClick={() => setExpanded(expanded === o.id ? null : o.id)}
              aria-expanded={expanded === o.id}
            >
              Why this might fit <span>{expanded === o.id ? '−' : '+'}</span>
            </button>
            {expanded === o.id && (
              <div className="match-reasons">
                {o.match.reasons.map((r) => (
                  <CheckList key={r}>{r}</CheckList>
                ))}
                {o.match.missing.map((r) => (
                  <p key={r}>{r}</p>
                ))}
                {o.match.conflicts.map((r) => (
                  <p className="amber-text" key={r}>
                    {r}
                  </p>
                ))}
                <small>
                  Sample payment: {prettyDate(o.paymentDate)}. Match reflects entered profile,
                  eligibility, skills, and time; it is not an acceptance probability.
                </small>
              </div>
            )}
            <div className="opportunity-actions">
              <Field label="Application status">
                <select
                  aria-label={`Status for ${o.provider}`}
                  disabled={busy}
                  value={o.status}
                  onChange={(e) =>
                    void save(
                      {
                        ...w,
                        applications: {
                          ...w.applications,
                          [o.id]: e.target.value as OpportunityStatus,
                        },
                      },
                      e.target.value === 'Awarded'
                        ? 'Award added to your semester funding.'
                        : 'Opportunity status saved.',
                    ).catch(() => {})
                  }
                >
                  {statuses.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
              <Button
                variant="secondary"
                disabled={busy || o.status === 'Awarded'}
                onClick={async () => {
                  try {
                    await save(
                      { ...w, scenario: { ...w.scenario, opportunityId: o.id } },
                      'Opportunity added to your what-if planner.',
                    );
                    navigate('scenario');
                  } catch {
                    /* Toast shows error. */
                  }
                }}
              >
                {o.status === 'Awarded' ? 'In your plan' : 'What if I receive this?'}
                <ArrowRight size={15} />
              </Button>
            </div>
          </section>
        ))}
      </div>
      {!visible.length && (
        <Empty
          title="Room for a new possibility"
          detail="Try another filter or save a listing to build your shortlist."
        />
      )}
      <p className="field-note">
        Only Awarded listings with a payment date inside your semester enter confirmed funding.
        Saved, Applying, and Applied are potential income only. Marking a sample award does not
        represent real income.
      </p>
    </>
  );
}
function InfoIcon() {
  return (
    <span className="info-dot" aria-hidden="true">
      i
    </span>
  );
}
