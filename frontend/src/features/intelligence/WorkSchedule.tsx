import { useState } from 'react';
import { BriefcaseBusiness, Plus, Pencil, CalendarDays } from 'lucide-react';
import type { Funding, Workspace } from '../../../../shared/schema';
import { cad, prettyDate } from '../../../../shared/finance';
import { useApp, uid } from '../../lib';
import { Badge, Button, Field, Modal, MoneyInput, SectionTitle } from '../../components/ui';
import { StudentPlan } from './StudentPlan';

const kinds = ['Co-op', 'Campus job', 'Part-time job', 'Summer job'] as const;
export function WorkSchedule({ asOf }: { asOf: string }) {
  const { w, save, busy, notify, demo } = useApp();
  const [view, setView] = useState('jobs');
  const [draft, setDraft] = useState<Funding | null>(null);
  const [term, setTerm] = useState<Workspace['semester'] | null>(null);
  const [error, setError] = useState('');
  const jobs = w.funding.filter((f) => f.type === 'Earned');
  const scheduled =
    w.workScheduleConfirmed ||
    jobs.some(
      (f) =>
        f.status === 'Expected' ||
        f.status === 'Confirmed' ||
        (f.status === 'Received' && f.endDate),
    );
  const persist = async (next: Workspace, message: string) => {
    try {
      await save(next, message);
      return true;
    } catch {
      return false;
    }
  };
  return (
    <div className="forecast-stack work-schedule">
      <div className="student-section-head">
        <SectionTitle
          title="Work & study"
          subtitle="Give every paycheque a place in your student year."
        />
        <Button
          variant="secondary"
          onClick={() => {
            setTerm(w.semester);
            setError('');
          }}
          disabled={demo}
        >
          <CalendarDays size={16} /> Edit study term
        </Button>
      </div>
      <div
        className="forecast-segment student-subnav"
        role="group"
        aria-label="Work and study views"
      >
        {[
          ['jobs', 'Jobs & co-op'],
          ['calendar', 'Tuition dates'],
          ['changes', 'Routine changes'],
          ['accounts', 'Payment accounts'],
        ].map(([id, label]) => (
          <button key={id} type="button" aria-pressed={view === id} onClick={() => setView(id)}>
            {label}
          </button>
        ))}
      </div>
      {demo && (
        <p className="inline-notice">
          This outlook uses a fixed sample schedule. Sign in to model your own work terms.
        </p>
      )}
      {view === 'jobs' ? (
        <>
          <div className="student-schedule-note">
            <BriefcaseBusiness size={24} aria-hidden="true" />
            <div>
              <strong>
                {scheduled
                  ? 'Your saved jobs set your income'
                  : 'Your pay is estimated from bank history'}
              </strong>
              <p>
                {scheduled
                  ? 'Pay stops after each last payday. Between jobs, the forecast uses your savings and other planned funding. Include all jobs you expect to keep.'
                  : 'Add your co-op or campus job to tell the forecast when wages start and stop.'}
              </p>
            </div>
            <Button
              disabled={busy || demo || jobs.length >= 100}
              onClick={() => {
                setError('');
                setDraft({
                  id: uid(),
                  name: '',
                  type: 'Earned',
                  status: 'Expected',
                  amount: 0,
                  frequency: 'Biweekly',
                  workKind: 'Co-op',
                  workStart: asOf,
                  workEnd: w.semester.end > asOf ? w.semester.end : asOf,
                  date: asOf,
                  endDate: w.semester.end > asOf ? w.semester.end : asOf,
                });
              }}
            >
              <Plus size={16} /> Add work term
            </Button>
          </div>
          <div className="student-job-grid">
            {jobs.map((job) => (
              <article className="card student-job" key={job.id}>
                <div className="student-section-head">
                  <Badge tone={job.endDate && job.endDate < asOf ? 'neutral' : 'green'}>
                    {job.workKind || 'Job'}
                  </Badge>
                  <Button
                    variant="ghost"
                    disabled={busy || demo}
                    aria-label={`Edit ${job.name}`}
                    onClick={() => {
                      setDraft(job);
                      setError('');
                    }}
                  >
                    <Pencil size={15} /> Edit
                  </Button>
                </div>
                <h3>{job.name}</h3>
                <p>
                  {prettyDate(job.workStart || job.date)} –{' '}
                  {job.workEnd || job.endDate
                    ? prettyDate((job.workEnd || job.endDate)!)
                    : 'No end date set'}
                </p>
                <strong className="student-job-pay">
                  {cad(job.amount)}{' '}
                  <small>
                    /{' '}
                    {job.frequency === 'Biweekly'
                      ? 'two weeks'
                      : job.frequency === 'Weekly'
                        ? 'week'
                        : job.frequency === 'Monthly'
                          ? 'month'
                          : 'one payment'}
                  </small>
                </strong>
                <div className="student-job-footer">
                  <span>
                    {job.endDate
                      ? `Pay ends ${prettyDate(job.endDate)}`
                      : 'Set a last payday to stop projected wages'}
                  </span>
                  <Badge tone="neutral">{job.status}</Badge>
                </div>
              </article>
            ))}
          </div>
          {!jobs.length && (
            <section className="card student-empty">
              <h3>Working this term, next term, or over the summer?</h3>
              <p>
                Add the dates and take-home pay for each job. Overlapping jobs are added together.
              </p>
              <Button
                variant="secondary"
                disabled={busy || demo || !!w.workScheduleConfirmed}
                onClick={() =>
                  void persist(
                    { ...w, workScheduleConfirmed: true },
                    'No job income planned. Historical wages will not repeat.',
                  )
                }
              >
                {w.workScheduleConfirmed ? 'No job income planned' : 'I have no job income planned'}
              </Button>
              {w.workScheduleConfirmed && (
                <Button
                  variant="ghost"
                  disabled={busy || demo}
                  onClick={() =>
                    void persist(
                      { ...w, workScheduleConfirmed: false },
                      'Income will use bank history.',
                    )
                  }
                >
                  Use bank history instead
                </Button>
              )}
            </section>
          )}
          <p className="field-note">
            Expected pay is an estimate. Jobs marked Applied are excluded. Grants, OSAP and other
            funding stay in your semester plan.
          </p>
        </>
      ) : (
        <StudentPlan asOf={asOf} view={view as 'calendar' | 'changes' | 'accounts'} />
      )}
      {draft && (
        <Modal
          title={jobs.some((f) => f.id === draft.id) ? 'Edit work term' : 'Add work term'}
          onClose={() => setDraft(null)}
        >
          <form
            className="student-work-form"
            onSubmit={async (event) => {
              event.preventDefault();
              setError('');
              if (
                !draft.workStart ||
                !draft.workEnd ||
                !draft.endDate ||
                draft.workEnd < draft.workStart ||
                draft.endDate < draft.date ||
                draft.date < draft.workStart
              ) {
                setError(
                  'Check your dates: work ends after it starts, and paydays run from the first payday to the last.',
                );
                return;
              }
              if (
                await persist(
                  {
                    ...w,
                    workScheduleConfirmed: true,
                    funding: [...w.funding.filter((f) => f.id !== draft.id), draft],
                  },
                  'Work term saved. Your outlook will use these pay dates.',
                )
              )
                setDraft(null);
            }}
          >
            <div className="form-stack">
              <Field label="Job or employer">
                <input
                  required
                  maxLength={160}
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="e.g. Winter engineering co-op"
                />
              </Field>
              <fieldset className="student-choice-field">
                <legend>Work type</legend>
                <div className="forecast-segment">
                  {kinds.map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      aria-pressed={draft.workKind === kind}
                      onClick={() => setDraft({ ...draft, workKind: kind })}
                    >
                      {kind}
                    </button>
                  ))}
                </div>
              </fieldset>
              <div className="form-grid">
                <Field label="Work starts">
                  <input
                    required
                    type="date"
                    value={draft.workStart || ''}
                    onChange={(e) => setDraft({ ...draft, workStart: e.target.value })}
                  />
                </Field>
                <Field label="Work ends">
                  <input
                    required
                    type="date"
                    min={draft.workStart}
                    value={draft.workEnd || ''}
                    onChange={(e) => setDraft({ ...draft, workEnd: e.target.value })}
                  />
                </Field>
              </div>
              <Field
                label="Take-home pay per paycheque"
                hint="Enter the amount after taxes and deductions."
              >
                <MoneyInput
                  value={draft.amount}
                  min={0.01}
                  onChange={(amount) => setDraft({ ...draft, amount })}
                />
              </Field>
              <fieldset className="student-choice-field">
                <legend>Pay frequency</legend>
                <div className="forecast-segment">
                  {(['Weekly', 'Biweekly', 'Monthly', 'Once'] as const).map((frequency) => (
                    <button
                      key={frequency}
                      type="button"
                      aria-pressed={draft.frequency === frequency}
                      onClick={() => setDraft({ ...draft, frequency })}
                    >
                      {frequency === 'Biweekly' ? 'Every two weeks' : frequency}
                    </button>
                  ))}
                </div>
              </fieldset>
              <div className="form-grid">
                <Field label="First payday">
                  <input
                    required
                    type="date"
                    min={draft.workStart}
                    value={draft.date}
                    onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                  />
                </Field>
                <Field label="Last payday" hint="Can fall after your last day at work.">
                  <input
                    required
                    type="date"
                    min={draft.date}
                    value={draft.endDate || ''}
                    onChange={(e) => setDraft({ ...draft, endDate: e.target.value })}
                  />
                </Field>
              </div>
              <p className="field-note">
                Pay repeats on this schedule through the last payday. Adjust that date if payroll
                runs later than your work term.
              </p>
              <fieldset className="student-choice-field">
                <legend>Pay status</legend>
                <div className="forecast-segment">
                  {(['Expected', 'Confirmed', 'Applied', 'Received'] as const).map((status) => (
                    <button
                      type="button"
                      key={status}
                      aria-pressed={draft.status === status}
                      onClick={() => setDraft({ ...draft, status })}
                    >
                      {status === 'Received' ? 'All received' : status}
                    </button>
                  ))}
                </div>
              </fieldset>
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
            </div>
            <div className="modal-actions">
              {jobs.some((f) => f.id === draft.id) && (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={async () => {
                    if (
                      await persist(
                        {
                          ...w,
                          workScheduleConfirmed: true,
                          funding: w.funding.filter((f) => f.id !== draft.id),
                        },
                        'Work term removed. No historical wages will be added.',
                      )
                    )
                      setDraft(null);
                  }}
                >
                  Remove job
                </Button>
              )}
              <Button type="button" variant="ghost" onClick={() => setDraft(null)}>
                Cancel
              </Button>
              <Button disabled={busy || draft.amount <= 0}>Save work term</Button>
            </div>
          </form>
        </Modal>
      )}
      {term && (
        <Modal title="Your study term" onClose={() => setTerm(null)}>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              if (
                term.end <= term.start ||
                Date.parse(term.end) - Date.parse(term.start) > 366 * 86400000
              ) {
                notify('Choose a term of up to one year, ending after it starts.', true);
                return;
              }
              if (await persist({ ...w, semester: term }, 'Study term updated.')) setTerm(null);
            }}
          >
            <div className="form-stack">
              <Field label="Term name">
                <input
                  required
                  maxLength={160}
                  value={term.name}
                  onChange={(e) => setTerm({ ...term, name: e.target.value })}
                />
              </Field>
              <div className="form-grid">
                <Field label="Term starts">
                  <input
                    required
                    type="date"
                    value={term.start}
                    onChange={(e) => setTerm({ ...term, start: e.target.value })}
                  />
                </Field>
                <Field label="Term ends">
                  <input
                    required
                    type="date"
                    min={term.start}
                    value={term.end}
                    onChange={(e) => setTerm({ ...term, end: e.target.value })}
                  />
                </Field>
              </div>
            </div>
            <div className="modal-actions">
              <Button type="button" variant="ghost" onClick={() => setTerm(null)}>
                Cancel
              </Button>
              <Button disabled={busy}>Save study term</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
