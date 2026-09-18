import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Compass,
  Leaf,
  Play,
  ShieldCheck,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { useState } from 'react';
import { Brand } from '../../components/ui';
import { cad } from '../../../../shared/finance';
import './landing.css';

function PublicHeader({ marketing = false }: { marketing?: boolean }) {
  return (
    <header className="landing-nav">
      <a href="#home" aria-label="Surplus home">
        <Brand />
      </a>
      <nav aria-label="Public navigation">
        {marketing && (
          <div className="marketing-nav-links">
            {[
              ['product', 'The product'],
              ['how-it-works', 'How it works'],
              ['questions', 'FAQs'],
            ].map(([id, label]) => (
              <button
                key={id}
                onClick={() =>
                  document.getElementById(id)?.scrollIntoView({
                    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
                      ? 'auto'
                      : 'smooth',
                  })
                }
              >
                {label}
              </button>
            ))}
          </div>
        )}
        <a href="#demo" className="landing-demo-link">
          Try demo
        </a>
        <a href="#login">Log in</a>
        <a href="#signup" className="landing-button">
          Sign up <ArrowUpRight size={16} />
        </a>
      </nav>
    </header>
  );
}

function SamplePlan({ weekly = 128.5, saving = 600 }: { weekly?: number; saving?: number }) {
  return (
    <div className="landing-plan">
      <div className="landing-plan-top">
        <span>
          <span className="landing-dot" /> YOUR SEMESTER, IN VIEW
        </span>
        <span>Sample plan</span>
      </div>
      <div className="landing-plan-greeting">A little clarity, Alex.</div>
      <p>Big plans. A little more room to make them.</p>
      <div className="landing-balance">
        <span>Weekly spending room</span>
        <strong>{cad(weekly, true)}</strong>
        <span>After planned essentials and savings</span>
      </div>
      <div className="landing-plan-row">
        <span>
          <CalendarDays size={18} /> Semester essentials
        </span>
        <strong>$8,640</strong>
      </div>
      <div className="landing-meter" aria-hidden="true">
        <span />
      </div>
      <div className="landing-plan-row">
        <span>
          <Leaf size={18} /> A little set aside
        </span>
        <strong>{cad(saving)}</strong>
      </div>
      <div className="landing-plan-note">
        <Sparkles size={19} />
        <div>
          <strong>Your future has a little breathing room.</strong>
          <p>One thoughtful step at a time.</p>
        </div>
      </div>
    </div>
  );
}

export function LandingPage() {
  return (
    <div className="landing-page">
      <div className="marketing-announcement">
        A little more room for student life.{' '}
        <a href="#demo">
          Explore Surplus <ArrowRight size={13} />
        </a>
      </div>
      <PublicHeader marketing />
      <main id="main-content">
        <section className="landing-hero" aria-labelledby="landing-title">
          <div className="landing-hero-copy">
            <span className="landing-eyebrow">
              <span className="landing-dot" /> MADE FOR STUDENT LIFE
            </span>
            <h1 id="landing-title">
              More life.
              <br />
              <em>Less money worry.</em>
            </h1>
            <p>
              Your semester, your money, your next big thing. Bring your budget, savings goals, and
              campus opportunities into one calmer space.
            </p>
            <div className="landing-actions">
              <a className="landing-button" href="#signup">
                Find your surplus <ArrowRight size={18} />
              </a>
              <a className="landing-secondary" href="#demo">
                <Play size={16} /> Try the demo
              </a>
            </div>
            <p className="landing-small">
              <ShieldCheck size={16} /> Explore the demo. No account or bank connection needed.
            </p>
          </div>
          <div className="landing-hero-art">
            <div className="landing-orbit" aria-hidden="true" />
            <SamplePlan />
            <div className="landing-floating">
              <Compass size={21} />
              <span>
                Beyond the budget.<strong>Find your next opportunity.</strong>
              </span>
            </div>
          </div>
        </section>
        <div className="landing-strip">
          <span>A little less figuring it out alone.</span>
          <span>PLAN YOUR SEMESTER</span>
          <span>MAKE ROOM FOR GOALS</span>
          <span>DISCOVER WHAT’S NEXT</span>
        </div>
        <section id="product" className="landing-features" aria-labelledby="features-title">
          <div className="landing-section-heading">
            <span className="landing-eyebrow">A BIGGER PICTURE. A CLEARER NEXT STEP.</span>
            <h2 id="features-title">
              Built around your life.
              <br />
              <em>Not just your balance.</em>
            </h2>
            <p>
              From the first tuition payment to the next possibility, see how it all fits together.
            </p>
          </div>
          <div className="landing-feature-grid">
            {[
              {
                icon: Wallet,
                title: 'Know what you have room for.',
                text: 'Plan your semester’s income and essentials, understand your spending, and give every week a little more clarity.',
                tag: 'YOUR MONEY, IN VIEW',
              },
              {
                icon: Compass,
                title: 'Find your next possibility.',
                text: 'Explore TMU resources, campus work, funding, and learning opportunities—with source links and ways to get in touch.',
                tag: 'BEYOND THE BUDGET',
              },
              {
                icon: Leaf,
                title: 'Make the “one day” plan.',
                text: 'Set savings goals and explore what-if scenarios. See how a small change could shape the rest of your semester.',
                tag: 'A LITTLE FURTHER',
              },
            ].map(({ icon: Icon, title, text, tag }) => (
              <article key={title}>
                <div className="landing-feature-icon">
                  <Icon size={25} />
                </div>
                <span className="landing-eyebrow">{tag}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>
        <ProductTour />
        <section id="how-it-works" className="marketing-how">
          <div className="landing-section-heading">
            <span className="landing-eyebrow">FROM “WHERE DO I START?” TO A PLAN.</span>
            <h2>
              A fresh start.
              <br />
              <em>Three simple steps.</em>
            </h2>
          </div>
          <div className="marketing-steps">
            {[
              [
                '01',
                'Make yourself at home.',
                'Create your account with Google, Microsoft, or a username and password. Your saved plan is there when you return.',
              ],
              [
                '02',
                'Give your semester a shape.',
                'Add your income, tuition, living costs, and savings goals. Start with what you know and adjust as life changes.',
              ],
              [
                '03',
                'Find your next good move.',
                'Review your budget, compare a what-if scenario, or follow up on a campus opportunity. Small steps, all in one place.',
              ],
            ].map(([number, title, text]) => (
              <article key={number}>
                <span>{number}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="marketing-principles">
          <div>
            <ShieldCheck size={30} />
            <span className="landing-eyebrow">START ON YOUR TERMS</span>
            <h2>
              Your plan.
              <br />
              <em>Your pace.</em>
            </h2>
            <p>
              You can build a semester plan without connecting a bank. Explore the preview first,
              then create your own space when you’re ready.
            </p>
            <a href="#demo" className="landing-secondary">
              Look around first <ArrowUpRight size={17} />
            </a>
          </div>
          <div className="marketing-principle-list">
            <article>
              <span>01</span>
              <div>
                <h3>No bank connection needed to begin.</h3>
                <p>
                  Start with the income and expenses you already know. Live connections are
                  available for supported Canadian banks through Plaid.
                </p>
              </div>
            </article>
            <article>
              <span>02</span>
              <div>
                <h3>A saved space that’s yours.</h3>
                <p>
                  Sign in to save your plan and return to it. Signing out closes your session while
                  keeping your progress.
                </p>
              </div>
            </article>
            <article>
              <span>03</span>
              <div>
                <h3>Useful context. Clear sources.</h3>
                <p>
                  Campus resources link to their original sources so you can check eligibility,
                  deadlines, and the right people to contact.
                </p>
              </div>
            </article>
          </div>
        </section>
        <section id="questions" className="marketing-faq">
          <div>
            <span className="landing-eyebrow">A FEW THINGS YOU MIGHT BE WONDERING</span>
            <h2>
              Good questions.
              <br />
              <em>Straight answers.</em>
            </h2>
            <p>Get to know Surplus before making yourself at home.</p>
          </div>
          <div>
            {[
              [
                'Who is Surplus for?',
                'Surplus is built for students managing semester costs, uneven income, and future goals. Its campus resource collection currently focuses on Toronto Metropolitan University.',
              ],
              [
                'Can I try it without signing up?',
                'Yes. The interactive demo uses a fictional student budget. You can change income and savings numbers without creating an account or entering personal financial information.',
              ],
              [
                'Do I need to connect my bank?',
                'No. You can create a plan manually. Connecting a supported Canadian bank is optional. You can also explore with a separate Sandbox test account.',
              ],
              [
                'How do I create an account?',
                'Choose Sign up and continue with Google or Microsoft, or create a username and password. Your first successful provider sign-in creates your account; the same provider brings you back next time.',
              ],
              [
                'Are the campus opportunities guaranteed?',
                'No. Listings help you discover resources and find application details. Availability, funding, deadlines, and eligibility are determined by each organization. Always check the linked source.',
              ],
              [
                'Is this financial advice?',
                'Surplus provides planning tools and educational information. Budget projections and what-if results are estimates to help you think through choices, not guarantees or personalized financial advice.',
              ],
            ].map(([question, answer]) => (
              <details key={question}>
                <summary>
                  {question}
                  <span aria-hidden="true">+</span>
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="landing-start">
          <span className="landing-eyebrow">YOUR NEXT CHAPTER STARTS HERE</span>
          <h2>
            A little more clarity.
            <br />
            <em>A little more surplus.</em>
          </h2>
          <p>Start with Google, Microsoft, or your own username and password.</p>
          <a href="#signup" className="landing-button">
            Create your account <ArrowRight size={18} />
          </a>
          <a href="#login" className="landing-text-link">
            Already have an account? Log in
          </a>
        </section>
      </main>
      <footer className="landing-footer">
        <div>
          <Brand />
          <p>For your semester. And everything after.</p>
        </div>
        <nav aria-label="Footer navigation">
          <a href="#home">Home</a>
          <a href="#demo">Explore demo</a>
          <a href="#login">Log in</a>
          <a href="#signup">Create account</a>
        </nav>
        <span>
          Made for student life.
          <br />
          All amounts in CAD.
        </span>
      </footer>
    </div>
  );
}

const tourPanels = [
  {
    label: 'Semester planning',
    eyebrow: 'THE WHOLE SEMESTER. ONE CLEAR VIEW.',
    title: 'Make room for the everyday. And the unexpected.',
    text: 'Tuition, rent, part-time work, that trip home. Bring the moving pieces together and understand what’s left for the weeks ahead.',
    rows: [
      ['Semester funds', '$11,296'],
      ['Planned essentials', '$8,640'],
      ['Savings goal', '$600'],
    ],
    total: ['Weekly spending room', '$128.50'],
  },
  {
    label: 'Savings & scenarios',
    eyebrow: 'SMALL CHANGES. NEW POSSIBILITIES.',
    title: 'See what a different choice could make possible.',
    text: 'Explore how extra income or a different savings goal affects your plan before you make a decision. Give the future a little more thought.',
    rows: [
      ['Extra semester income', '+$1,600'],
      ['New savings goal', '$1,400'],
      ['Semester length', '16 weeks'],
    ],
    total: ['Sample weekly spending room', '$178.50'],
  },
  {
    label: 'Campus opportunities',
    eyebrow: 'YOUR NEXT STEP COULD BE CLOSER.',
    title: 'Look beyond the budget. Find a way forward.',
    text: 'Explore TMU learning zones, student resources, campus work, and funding information. Keep track of the possibilities you want to follow up on.',
    rows: [
      ['Discover', 'Browse resources'],
      ['Get the details', 'Open the source'],
      ['Take the next step', 'Track your follow-up'],
    ],
    total: ['A clearer path from', '“Maybe” to next step.'],
  },
];
function ProductTour() {
  const [selected, setSelected] = useState(0);
  const panel = tourPanels[selected];
  return (
    <section className="marketing-tour" aria-labelledby="tour-title">
      <div className="marketing-tour-heading">
        <span className="landing-eyebrow">LESS TAB-HOPPING. MORE BIG-PICTURE THINKING.</span>
        <h2 id="tour-title">
          One space for
          <br />
          <em>what comes next.</em>
        </h2>
      </div>
      <div className="marketing-tour-tabs" aria-label="Product previews">
        {tourPanels.map((item, i) => (
          <button key={item.label} aria-pressed={selected === i} onClick={() => setSelected(i)}>
            {item.label}
          </button>
        ))}
      </div>
      <div className="marketing-tour-content">
        <div>
          <span className="landing-eyebrow">{panel.eyebrow}</span>
          <h3>{panel.title}</h3>
          <p>{panel.text}</p>
          <a href="#demo">
            Try the budget preview <ArrowRight size={17} />
          </a>
        </div>
        <div className="marketing-tour-card">
          <div className="marketing-window">
            <span />
            <span />
            <span />
            <small>Surplus / {panel.label} · Illustration</small>
          </div>
          {panel.rows.map(([label, value]) => (
            <div className="marketing-preview-row" key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
          <div className="marketing-preview-total">
            <span>{panel.total[0]}</span>
            <strong>{panel.total[1]}</strong>
          </div>
        </div>
      </div>
    </section>
  );
}
