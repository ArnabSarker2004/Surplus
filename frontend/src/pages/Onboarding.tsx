import { BankConnection } from '../features/banking/BankConnection';
import { ChoiceField } from '../components/ChoiceField';
import { useAuth } from '../features/auth/AuthGate';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  GraduationCap,
  LockKeyhole,
  Search,
  Sprout,
  X,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';
import { institutions, interests, opportunityTypes, skills } from '../../../shared/demo';
import { cad, plan } from '../../../shared/finance';
import { categories, workspaceSchema, type Profile, type Workspace } from '../../../shared/schema';
import { ExpenseEditor, FundingEditor } from '../components/Editors';
import { Badge, Brand, Button, Field, MoneyInput, Progress } from '../components/ui';

const steps = [
  'Your school',
  'Your studies',
  'Your day-to-day',
  'Your costs',
  'Your funding',
  'Your goals',
  'Your possibilities',
  'Your bank',
  'Your plan',
];
const titles = [
  'Where are you studying?',
  'First, a little about you.',
  'What does your everyday look like?',
  'Let’s make room for the real costs.',
  'Every source has a place.',
  'What are you working toward?',
  'Good things are out there.',
  'Bring your spending into view.',
  'Your semester starts here.',
];
const descriptions = [
  'A familiar starting point for your costs, resources, and opportunities.',
  'A few details help us make your plan feel like yours.',
  'School is only one part of your life. Your plan should reflect the rest.',
  'From tuition to your morning coffee. Estimates are a perfectly good start.',
  'Separate the money you have, the money you expect, and the money you’ve applied for.',
  'A little stability now. A little more possibility later.',
  'Tell us what you’d like to explore and the skills you’d like to bring.',
  'Connect securely for real spending insights, or continue with a manual plan.',
  'Take a moment to check the details. You can always change them later.',
];
function Tags({
  values,
  selected,
  onChange,
}: {
  values: readonly string[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <div className="tag-picker">
      {values.map((v) => (
        <button
          type="button"
          className={`tag ${selected.includes(v) ? 'selected' : ''}`}
          aria-pressed={selected.includes(v)}
          key={v}
          onClick={() =>
            onChange(selected.includes(v) ? selected.filter((s) => s !== v) : [...selected, v])
          }
        >
          {selected.includes(v) && <Check size={14} />} {v}
        </button>
      ))}
    </div>
  );
}
export function Onboarding({
  initial,
  onCancel,
  onFinish,
}: {
  initial: Workspace;
  onCancel: () => void;
  onFinish: (w: Workspace) => Promise<void>;
}) {
  const { draftKey } = useAuth();
  const [w, setW] = useState(initial);
  const [step, setStep] = useState(0);
  const [search, setSearch] = useState('');
  const [customSchool, setCustomSchool] = useState(
    Boolean(
      initial.profile.institution &&
      !institutions.some((i) => i.name === initial.profile.institution),
    ),
  );
  const [error, setError] = useState('');
  const [building, setBuilding] = useState(false);
  const [bankBusy, setBankBusy] = useState(false);
  const [quick, setQuick] = useState(false);
  const [buildStep, setBuildStep] = useState(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    try {
      localStorage.setItem(draftKey, JSON.stringify(w));
    } catch {
      /* Server save is still available if storage is full. */
    }
  }, [w, draftKey]);
  const profile = (patch: Partial<Profile>) => setW({ ...w, profile: { ...w.profile, ...patch } });
  const p = plan(w, []);
  const next = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (step === 0 && !w.profile.institution) {
      setError('Choose your institution to continue.');
      return;
    }
    if (step === 1 && w.semester.end <= w.semester.start) {
      setError('Your semester must end after it starts.');
      return;
    }
    if (bankBusy) return;
    if (step < 8) {
      setStep(
        quick
          ? (({ 0: 1, 1: 3, 3: 4, 4: 7, 7: 8 } as Record<number, number>)[step] ?? step + 1)
          : step + 1,
      );
      window.scrollTo({ top: 0 });
      return;
    }
    const result = workspaceSchema.safeParse(w);
    if (!result.success) {
      setError(result.error.issues.map((i) => `${i.path.join(' → ')}: ${i.message}`).join(' '));
      return;
    }
    setBuilding(true);
    try {
      for (let i = 0; i < 3; i++) {
        setBuildStep(i);
        await new Promise((resolve) => setTimeout(resolve, 30));
      }
      await onFinish(w);
    } catch {
      setBuilding(false);
      setError('Your plan could not be saved. Please try again.');
    }
  };
  const buildMessages = [
    'Organizing your costs and funding',
    'Building your semester timeline',
    'Finding your next possibilities',
  ];
  return (
    <div className="onboarding">
      <header className="onboarding-header">
        <Brand />
        <span>YOUR NEXT CHAPTER</span>
        <button className="icon-button" aria-label="Save draft and exit setup" onClick={onCancel}>
          <X size={21} />
        </button>
      </header>
      {building ? (
        <div className="building">
          <div className="building-sprout">
            <Sprout size={50} strokeWidth={1.3} />
          </div>
          <span className="eyebrow">A LITTLE CLARITY IS ON ITS WAY</span>
          <h1>
            Making room for <em>your future.</em>
          </h1>
          <div className="build-messages">
            {buildMessages.map((m, i) => (
              <div key={m} className={i <= buildStep ? 'complete' : ''}>
                <CheckCircle2 size={19} />
                {m}
              </div>
            ))}
          </div>
          <p>Simple calculations. A plan you can understand.</p>
        </div>
      ) : (
        <>
          <div className="onboarding-progress">
            <div>
              <span>
                Step {quick ? Math.max(1, [0, 1, 3, 4, 7, 8].indexOf(step) + 1) : step + 1} of{' '}
                {quick ? 6 : 9}
              </span>
              <strong>{steps[step]}</strong>
              <span>
                Your draft saves as you go <LockKeyhole size={12} />
              </span>
            </div>
            <Progress
              value={
                quick
                  ? ((Math.max(0, [0, 1, 3, 4, 7, 8].indexOf(step)) + 1) / 6) * 100
                  : ((step + 1) / 9) * 100
              }
              label="Setup progress"
            />
          </div>
          <div className="onboarding-layout">
            <form onSubmit={next} className="onboarding-form" id="main-content" tabIndex={-1}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.22 }}
                >
                  <div className="eyebrow">{steps[step]}</div>
                  <h1>{titles[step]}</h1>
                  <p className="onboarding-description">{descriptions[step]}</p>
                  {step === 0 && (
                    <>
                      <div className="setup-shortcuts" aria-label="Setup length">
                        <button type="button" aria-pressed={!quick} onClick={() => setQuick(false)}>
                          Full setup · 9 steps
                        </button>
                        <button type="button" aria-pressed={quick} onClick={() => setQuick(true)}>
                          Quick setup · 6 steps
                        </button>
                      </div>
                      <p className="field-note">
                        Quick setup covers school, studies, costs, funding, bank connection, and
                        review. Add goals and preferences later.
                      </p>
                      <div className="search-field">
                        <Search size={18} />
                        <input
                          aria-label="Search institutions"
                          placeholder="Find your university"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                        />
                      </div>
                      <div className="institution-grid">
                        {institutions
                          .filter((i) =>
                            `${i.name} ${i.short}`.toLowerCase().includes(search.toLowerCase()),
                          )
                          .map((i, index) => (
                            <motion.button
                              type="button"
                              key={i.id}
                              className={`institution-card ${w.profile.institution === i.name ? 'selected' : ''} ${i.id === 'tmu' ? 'featured' : ''}`}
                              aria-pressed={w.profile.institution === i.name}
                              onClick={() => {
                                setCustomSchool(false);
                                profile({ institution: i.name });
                              }}
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: reduced ? 0 : index * 0.035 }}
                            >
                              <span className="institution-monogram" style={{ color: i.color }}>
                                {i.short}
                              </span>
                              {w.profile.institution === i.name && (
                                <span className="institution-check">
                                  <Check size={13} />
                                </span>
                              )}
                              <strong>{i.name}</strong>
                              <small>{i.city}</small>
                              {i.id === 'tmu' && <span className="tmu-note">OUR FIRST CAMPUS</span>}
                            </motion.button>
                          ))}
                      </div>
                      <button
                        type="button"
                        className="text-link"
                        onClick={() => {
                          setCustomSchool(true);
                          profile({ institution: 'Other institution' });
                        }}
                      >
                        My institution isn’t listed <ArrowRight size={15} />
                      </button>
                      {customSchool && (
                        <Field label="Institution name">
                          <input
                            required
                            value={
                              w.profile.institution === 'Other institution'
                                ? ''
                                : w.profile.institution
                            }
                            onChange={(e) =>
                              profile({ institution: e.target.value || 'Other institution' })
                            }
                            placeholder="Enter your institution"
                          />
                        </Field>
                      )}
                      {w.profile.institution && w.profile.institution !== institutions[0].name && (
                        <p className="inline-notice">
                          Your semester plan works anywhere. Sample campus opportunities are
                          currently focused on TMU; eligibility will be shown clearly.
                        </p>
                      )}
                      <p className="field-note">
                        University names identify institutions only. Surplus is independently built.
                      </p>
                    </>
                  )}
                  {step === 1 && (
                    <div className="form-grid">
                      <Field label="What should we call you?">
                        <input
                          required
                          autoComplete="given-name"
                          value={w.profile.name}
                          onChange={(e) => profile({ name: e.target.value })}
                          placeholder="Your first name"
                        />
                      </Field>
                      <ChoiceField
                        label="Faculty"
                        value={w.profile.faculty}
                        onChange={(faculty) => profile({ faculty })}
                        options={[
                          'Engineering',
                          'Science',
                          'Business',
                          'Arts',
                          'Design',
                          'Community Services',
                          'Health Sciences',
                          'Law',
                          'Graduate Studies',
                          'Undeclared',
                        ]}
                      />
                      <ChoiceField
                        label="Program"
                        value={w.profile.program}
                        onChange={(program) => profile({ program })}
                        options={[
                          'Computer Engineering',
                          'Computer Science',
                          'Business Management',
                          'Business Technology Management',
                          'Accounting & Finance',
                          'Psychology',
                          'Nursing',
                          'Design',
                          'Arts',
                          'Undeclared',
                        ]}
                      />
                      <Field
                        label="Semester preset"
                        hint="Approximate term dates — adjust to your school’s calendar below."
                      >
                        <select
                          defaultValue=""
                          onChange={(e) => {
                            if (!e.target.value) return;
                            const [name, start, end] = e.target.value.split('|');
                            setW({ ...w, semester: { ...w.semester, name, start, end } });
                          }}
                        >
                          <option value="">Choose a term to fill dates</option>
                          {[new Date().getFullYear(), new Date().getFullYear() + 1].flatMap(
                            (year) =>
                              [
                                ['Winter', '01-01', '04-30'],
                                ['Summer', '05-01', '08-31'],
                                ['Fall', '09-01', '12-31'],
                              ].map(([term, start, end]) => (
                                <option
                                  key={`${term}${year}`}
                                  value={`${term} ${year}|${year}-${start}|${year}-${end}`}
                                >
                                  {term} {year}
                                </option>
                              )),
                          )}
                        </select>
                      </Field>
                      <Field label="Year of study">
                        <select
                          value={w.profile.year}
                          onChange={(e) => profile({ year: +e.target.value })}
                        >
                          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                            <option key={i} value={i}>
                              Year {i}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Student status">
                        <select
                          value={w.profile.residency}
                          onChange={(e) =>
                            profile({ residency: e.target.value as Profile['residency'] })
                          }
                        >
                          <option>Domestic</option>
                          <option>International</option>
                        </select>
                      </Field>
                      <Field label="Study load">
                        <select
                          value={w.profile.study}
                          onChange={(e) => profile({ study: e.target.value as Profile['study'] })}
                        >
                          <option>Full-time</option>
                          <option>Part-time</option>
                        </select>
                      </Field>
                      <Field label="Semester name">
                        <input
                          required
                          value={w.semester.name}
                          onChange={(e) =>
                            setW({ ...w, semester: { ...w.semester, name: e.target.value } })
                          }
                        />
                      </Field>
                      <label className="checkbox-line">
                        <input
                          type="checkbox"
                          checked={w.profile.coop}
                          onChange={(e) => profile({ coop: e.target.checked })}
                        />{' '}
                        I’m in a co-op program
                      </label>
                      <Field label="Semester starts">
                        <input
                          type="date"
                          required
                          value={w.semester.start}
                          onChange={(e) =>
                            setW({ ...w, semester: { ...w.semester, start: e.target.value } })
                          }
                        />
                      </Field>
                      <Field label="Semester ends">
                        <input
                          type="date"
                          required
                          value={w.semester.end}
                          min={w.semester.start}
                          onChange={(e) =>
                            setW({ ...w, semester: { ...w.semester, end: e.target.value } })
                          }
                        />
                      </Field>
                    </div>
                  )}
                  {step === 2 && (
                    <div className="form-stack">
                      <Field label="Living situation">
                        <select
                          value={w.profile.living}
                          onChange={(e) => profile({ living: e.target.value as Profile['living'] })}
                        >
                          <option>With family</option>
                          <option>Renting</option>
                          <option>Residence</option>
                        </select>
                      </Field>
                      {w.profile.living !== 'With family' && (
                        <div className="inline-notice">
                          Remember to include rent or residence and utilities in your semester costs
                          on the next step.
                        </div>
                      )}
                      <Field label="Getting to campus">
                        <select
                          value={w.profile.transportation}
                          onChange={(e) =>
                            profile({ transportation: e.target.value as Profile['transportation'] })
                          }
                        >
                          <option>Public transit</option>
                          <option>Walking / cycling</option>
                          <option>Car</option>
                        </select>
                      </Field>
                      <label className="checkbox-line">
                        <input
                          type="checkbox"
                          checked={w.profile.employed}
                          onChange={(e) => profile({ employed: e.target.checked })}
                        />{' '}
                        I’m working during the semester
                      </label>
                      {w.profile.employed && (
                        <div className="form-grid">
                          <Field label="Take-home pay per payment">
                            <MoneyInput
                              value={w.profile.payAmount}
                              onChange={(payAmount) => profile({ payAmount })}
                            />
                          </Field>
                          <Field label="Pay frequency">
                            <select
                              value={w.profile.payFrequency}
                              onChange={(e) =>
                                profile({ payFrequency: e.target.value as Profile['payFrequency'] })
                              }
                            >
                              <option>Weekly</option>
                              <option>Biweekly</option>
                              <option>Monthly</option>
                            </select>
                          </Field>
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => {
                              const existing = w.funding.find((f) => f.type === 'Earned');
                              setW({
                                ...w,
                                funding: [
                                  ...w.funding.filter(
                                    (f) => f.id !== (existing?.id ?? 'onboarding-pay'),
                                  ),
                                  {
                                    id: existing?.id ?? 'onboarding-pay',
                                    name: 'Employment income',
                                    amount: w.profile.payAmount,
                                    date: existing?.date ?? w.semester.start,
                                    type: 'Earned',
                                    status: 'Expected',
                                    frequency: w.profile.payFrequency,
                                  },
                                ],
                              });
                              setError(
                                'Employment added to your funding. Adjust its first payday in the funding step.',
                              );
                            }}
                          >
                            Add employment to funding
                          </Button>
                        </div>
                      )}
                      <div>
                        <h3>Skills you bring</h3>
                        <Tags
                          values={skills}
                          selected={w.profile.skills}
                          onChange={(skills) => profile({ skills })}
                        />
                      </div>
                      <div>
                        <h3>Things you care about</h3>
                        <Tags
                          values={interests}
                          selected={w.profile.interests}
                          onChange={(interests) => profile({ interests })}
                        />
                      </div>
                    </div>
                  )}
                  {step === 3 && (
                    <>
                      <ExpenseEditor
                        value={w.expenses}
                        onChange={(expenses) => setW({ ...w, expenses })}
                        date={w.semester.start}
                      />
                      <div className="live-total">
                        <span>Estimated semester costs</span>
                        <strong>{cad(p.cost)}</strong>
                      </div>
                    </>
                  )}
                  {step === 4 && (
                    <>
                      {w.profile.residency === 'International' && (
                        <div className="inline-notice">
                          Funding eligibility varies. Only add grants or loans you are eligible for;
                          OSAP is not assumed.
                        </div>
                      )}
                      <FundingEditor
                        value={w.funding}
                        onChange={(funding) => setW({ ...w, funding })}
                        date={w.semester.start}
                      />
                      <div className="live-total">
                        <span>Confirmed + expected earnings</span>
                        <strong>{cad(p.funding)}</strong>
                      </div>
                      <p className="field-note">
                        {cad(p.pending)} pending, excluded from your base plan.
                      </p>
                    </>
                  )}
                  {step === 5 && (
                    <div className="form-stack">
                      <div className="form-grid">
                        <Field label="Desired end-of-semester balance">
                          <MoneyInput
                            value={w.semester.minimumBalance}
                            onChange={(minimumBalance) =>
                              setW({ ...w, semester: { ...w.semester, minimumBalance } })
                            }
                          />
                        </Field>
                        <Field label="Emergency buffer target">
                          <MoneyInput
                            value={w.semester.emergencyTarget}
                            onChange={(emergencyTarget) =>
                              setW({ ...w, semester: { ...w.semester, emergencyTarget } })
                            }
                          />
                        </Field>
                      </div>
                      <div>
                        <h3>Your priorities</h3>
                        <Tags
                          values={[
                            'Finish the semester comfortably',
                            'Build an emergency fund',
                            'Pay down debt',
                            'Save for something',
                            'Learn about investing',
                          ]}
                          selected={w.profile.priorities}
                          onChange={(priorities) => profile({ priorities })}
                        />
                      </div>
                      <div>
                        <h3>Categories you’d consider reducing</h3>
                        <Tags
                          values={categories.filter((c) =>
                            [
                              'Eating Out',
                              'Coffee',
                              'Subscriptions',
                              'Shopping',
                              'Entertainment',
                              'Rideshare',
                            ].includes(c),
                          )}
                          selected={w.profile.reduceCategories}
                          onChange={(v) =>
                            profile({ reduceCategories: v as Profile['reduceCategories'] })
                          }
                        />
                      </div>
                      <label className="checkbox-line">
                        <input
                          type="checkbox"
                          checked={w.profile.highInterestDebt}
                          onChange={(e) => profile({ highInterestDebt: e.target.checked })}
                        />{' '}
                        I have high-interest debt
                      </label>
                      <label className="checkbox-line">
                        <input
                          type="checkbox"
                          checked={w.profile.stableIncome}
                          onChange={(e) => profile({ stableIncome: e.target.checked })}
                        />{' '}
                        My income is reasonably stable
                      </label>
                      <label className="checkbox-line">
                        <input
                          type="checkbox"
                          checked={w.profile.wantsInvesting}
                          onChange={(e) => profile({ wantsInvesting: e.target.checked })}
                        />{' '}
                        I’d like to learn about investing
                      </label>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          setW({
                            ...w,
                            goals: [
                              ...w.goals.filter((g) => !/emergency/i.test(g.name)),
                              {
                                id: 'setup-emergency',
                                name: 'Emergency fund',
                                target: Math.max(1, w.semester.emergencyTarget),
                                current:
                                  w.goals.find((g) => /emergency/i.test(g.name))?.current ?? 0,
                                date: w.semester.end,
                                priority: 'High',
                                contribution: 0,
                                frequency: 'Monthly',
                              },
                            ],
                          });
                          setError(
                            'Emergency savings goal added. You can set its current balance from Savings goals.',
                          );
                        }}
                      >
                        Add emergency savings goal
                      </Button>
                    </div>
                  )}
                  {step === 6 && (
                    <div className="form-stack">
                      <div>
                        <h3>Opportunities you’d like to explore</h3>
                        <Tags
                          values={opportunityTypes}
                          selected={w.profile.opportunityTypes}
                          onChange={(opportunityTypes) => profile({ opportunityTypes })}
                        />
                      </div>
                      <div className="form-grid">
                        <Field label="Available hours per week">
                          <select
                            value={w.profile.weeklyHours}
                            onChange={(e) => profile({ weeklyHours: Number(e.target.value) })}
                          >
                            {[...new Set([0, 2, 5, 10, 15, 20, 30, 40, w.profile.weeklyHours])]
                              .sort((a, b) => a - b)
                              .map((hours) => (
                                <option key={hours} value={hours}>
                                  {hours === 0 ? 'Not right now' : `${hours} hours / week`}
                                </option>
                              ))}
                          </select>
                        </Field>
                        <Field label="Where you’d like to work">
                          <select
                            value={w.profile.workPreference}
                            onChange={(e) =>
                              profile({
                                workPreference: e.target.value as Profile['workPreference'],
                              })
                            }
                          >
                            <option>Either</option>
                            <option>Remote</option>
                            <option>On campus</option>
                          </select>
                        </Field>
                      </div>
                      <div>
                        <h3>Skills you’d like to develop</h3>
                        <Tags
                          values={skills}
                          selected={w.profile.developSkills}
                          onChange={(developSkills) => profile({ developSkills })}
                        />
                      </div>
                      <div className="inline-notice">
                        Opportunities in this MVP are clearly labelled examples. Matching explains
                        fit; it does not predict acceptance.
                      </div>
                    </div>
                  )}
                  {step === 7 && (
                    <div className="setup-bank-step">
                      <BankConnection
                        onBusy={setBankBusy}
                        onChange={(_next, source) => setW((current) => ({ ...current, source }))}
                      />
                      <div className="bank-insight-preview">
                        <span className="eyebrow">WHAT YOUR CONNECTION UNLOCKS</span>
                        <h3>A clearer picture, with less manual entry.</h3>
                        <ul>
                          <li>Account balances and categorized purchase history.</li>
                          <li>Spending trends and suggestions based on your transactions.</li>
                          <li>Budget comparisons and savings estimates alongside your plan.</li>
                        </ul>
                        <p>
                          Build private, local forecasts from your history in Forecasts & AI after
                          setup. Models run only when you request a forecast.
                        </p>
                      </div>
                    </div>
                  )}
                  {step === 8 && (
                    <div className="review-sections">
                      {[
                        {
                          label: 'Bank connection',
                          value:
                            w.source === 'live'
                              ? 'Live bank connected'
                              : w.source === 'sandbox'
                                ? 'Sandbox test bank connected'
                                : 'Manual planning - connect a bank later in Settings',
                          step: 7,
                        },
                        {
                          label: 'Your studies',
                          value: `${w.profile.name} · ${w.profile.institution} · Year ${w.profile.year} ${w.profile.program}`,
                          step: 1,
                        },
                        {
                          label: 'Your semester',
                          value: `${w.semester.name} · ${w.semester.start} to ${w.semester.end}`,
                          step: 1,
                        },
                        {
                          label: 'Planned costs',
                          value: `${cad(p.cost)} across ${w.expenses.length} expenses`,
                          step: 3,
                        },
                        {
                          label: 'Funding',
                          value: `${cad(p.confirmed)} confirmed · ${cad(p.earned)} expected earnings · ${cad(p.pending)} pending`,
                          step: 4,
                        },
                        {
                          label: 'Your goals',
                          value: `${cad(w.semester.minimumBalance)} minimum balance · ${cad(w.semester.emergencyTarget)} emergency target`,
                          step: 5,
                        },
                        {
                          label: 'Your possibilities',
                          value: `${w.profile.weeklyHours} hours / week · ${w.profile.opportunityTypes.join(', ') || 'No preferences yet'}`,
                          step: 6,
                        },
                      ].map((r) => (
                        <div className="review-section" key={r.label}>
                          <div>
                            <small>{r.label}</small>
                            <strong>{r.value}</strong>
                          </div>
                          <button
                            type="button"
                            className="text-link"
                            onClick={() => {
                              if (quick && ![0, 1, 3, 4, 7, 8].includes(r.step)) setQuick(false);
                              setStep(r.step);
                            }}
                          >
                            Edit
                          </button>
                        </div>
                      ))}
                      <div className="inline-notice">
                        Amounts are your estimates, not official school fees. Monthly expenses occur
                        once per month from their first date. Pending funding is excluded.{' '}
                        {w.expenses.length === 0 && 'No costs have been added yet. '}
                        {w.funding.length === 0 && 'No funding has been added yet.'}
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
              {error && (
                <p role="alert" className="form-error">
                  {error}
                </p>
              )}
              <div className="onboarding-actions">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={bankBusy}
                  onClick={() => {
                    if (step === 0) onCancel();
                    else
                      setStep(
                        quick
                          ? (({ 1: 0, 3: 1, 4: 3, 7: 4, 8: 7 } as Record<number, number>)[step] ??
                              step - 1)
                          : step - 1,
                      );
                    setError('');
                  }}
                >
                  <ArrowLeft size={17} /> Back
                </Button>
                <span>
                  {step < 8 ? 'A little closer to clarity.' : 'Looks like a good place to start.'}
                </span>
                <Button type="submit" disabled={bankBusy}>
                  {step === 8 ? 'Build my semester plan' : 'Continue'}
                  <ArrowRight size={17} />
                </Button>
              </div>
            </form>
            <aside className="onboarding-aside">
              <span className="aside-flower">✳</span>
              <span className="eyebrow">THE BIGGER PICTURE</span>
              <h2>
                A plan for the
                <br />
                life you’re
                <br />
                <em>building.</em>
              </h2>
              <p>You don’t need to have it all figured out. A few small steps are a great start.</p>
              {step > 2 ? (
                <div className="aside-summary">
                  <div>
                    <span>Semester costs</span>
                    <strong>{cad(p.cost)}</strong>
                  </div>
                  <div>
                    <span>Confirmed funding</span>
                    <strong>{cad(p.confirmed)}</strong>
                  </div>
                  <div>
                    <span>Expected earnings</span>
                    <strong>{cad(p.earned)}</strong>
                  </div>
                  <div>
                    <span>Pending funding</span>
                    <strong>{cad(p.pending)}</strong>
                  </div>
                </div>
              ) : (
                <div className="aside-school">
                  <GraduationCap size={24} />
                  <span>{w.profile.institution || 'Your campus. Your next chapter.'}</span>
                </div>
              )}
              <Badge tone="green">
                <LockKeyhole size={12} /> Draft saved on this device
              </Badge>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
