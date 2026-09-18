import { ArrowUpRight, CalendarPlus, Mail } from 'lucide-react';
import { useState } from 'react';
import {
  needsResourceReview,
  resourceCalendar,
  resourceEmail,
  resourceFit,
  resourceStages,
  resourceStatus,
  type ResourceProgress,
  type StudentResource,
} from '../../../../shared/resources';
import { Badge, Button, Field, Modal } from '../../components/ui';
import { useApp } from '../../lib';

export function ResourceDetail({
  resource: r,
  onClose,
}: {
  resource: StudentResource;
  onClose: () => void;
}) {
  const { w, save, busy } = useApp();
  const [progress, setProgress] = useState<ResourceProgress>(
    w.resourceProgress?.[r.id] ?? { stage: 'Saved', notes: '', followUp: null },
  );
  const fit = resourceFit(r, w.profile);
  const email = resourceEmail(r, w.profile.name);
  const calendar = resourceCalendar(r);
  const download = () => {
    if (!calendar) return;
    const url = URL.createObjectURL(new Blob([calendar], { type: 'text/calendar;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${r.id}.ics`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <Modal title={r.title} onClose={onClose}>
      <div className="resource-detail">
        <div className="resource-labels">
          <Badge>{r.kind}</Badge>
          <Badge tone="amber">{resourceStatus(r)}</Badge>
        </div>
        <p>{r.summary}</p>
        <section>
          <h3>{r.benefit.label}</h3>
          <p>{r.benefit.note}</p>
          <p>
            <strong>Time commitment:</strong> {r.commitment}
          </p>
        </section>
        <section>
          <h3>Dates & availability</h3>
          <p>{r.timing}</p>
          {r.event && <p>{r.event.location}</p>}
          {calendar && (
            <Button variant="secondary" onClick={download}>
              <CalendarPlus size={16} /> Add {r.event ? 'event' : 'deadline'} to calendar
            </Button>
          )}
          {!r.event && r.deadline && (
            <small>All-day reminder. The source does not specify a cutoff time.</small>
          )}
        </section>
        <section>
          <h3>Who it’s for</h3>
          <ul>
            {r.eligibility.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          {fit.length > 0 && (
            <div className="resource-caution">
              {fit.map((item) => (
                <p key={item}>{item}</p>
              ))}
            </div>
          )}
          <small>
            The provider confirms eligibility. Your profile does not establish acceptance.
          </small>
        </section>
        <section>
          <h3>Your next steps</h3>
          <ol>
            {r.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <a
            className="button primary"
            href={r.action.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {r.action.label} <ArrowUpRight size={16} />
            <span className="sr-only"> (opens in new tab)</span>
          </a>
          {r.action.login && (
            <small>
              Sign in on the official TMU service. Surplus does not request your university
              password.
            </small>
          )}
        </section>
        <section>
          <h3>Make a connection</h3>
          {r.contact && email ? (
            <>
              <p>
                <strong>{r.contact.name}</strong>
                <br />
                {r.contact.purpose}
              </p>
              <a className="resource-email" href={`mailto:${r.contact.email}`}>
                {r.contact.email}
              </a>
              <a className="button secondary" href={email}>
                <Mail size={16} /> Draft an inquiry
              </a>
              <small>
                Opens your email app with an editable message. You choose whether to send it.
              </small>
            </>
          ) : (
            <p>
              The reviewed page does not provide a general application email. Use the official
              page’s form or the contact in the specific posting.
            </p>
          )}
        </section>
        <section>
          <h3>Sources & freshness</h3>
          <ul>
            {r.sources.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noopener noreferrer">
                  {s.label} <ArrowUpRight size={13} />
                  <span className="sr-only"> (opens in new tab)</span>
                </a>
              </li>
            ))}
          </ul>
          <p>
            Reviewed {r.checkedAt}.{' '}
            {needsResourceReview(r)
              ? 'This review is over 30 days old; recheck details before acting.'
              : 'Confirm availability with the provider before applying.'}
          </p>
          <small>This is a researched snapshot. Automatic website monitoring is not enabled.</small>
        </section>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            try {
              await save(
                { ...w, resourceProgress: { ...w.resourceProgress, [r.id]: progress } },
                'Resource and follow-up notes saved.',
              );
              onClose();
            } catch {
              /* App displays error. */
            }
          }}
        >
          <h3>Your application & follow-up</h3>
          <div className="resource-form-row">
            <Field label="My progress">
              <select
                value={progress.stage}
                onChange={(e) =>
                  setProgress({ ...progress, stage: e.target.value as ResourceProgress['stage'] })
                }
              >
                {resourceStages.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field label="Follow-up date">
              <input
                type="date"
                value={progress.followUp ?? ''}
                onChange={(e) => setProgress({ ...progress, followUp: e.target.value || null })}
              />
            </Field>
          </div>
          <Field label="My notes">
            <textarea
              rows={3}
              maxLength={2000}
              placeholder="Questions to ask, documents to prepare, or a person to follow up with…"
              value={progress.notes}
              onChange={(e) => setProgress({ ...progress, notes: e.target.value })}
            />
          </Field>
          <small>
            Follow-ups appear in My shortlist. Saving a resource or marking it accepted does not add
            income to your plan.
          </small>
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save resource & notes'}
          </Button>
        </form>
      </div>
    </Modal>
  );
}
