import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowUpRight, Check, GraduationCap, Sprout } from 'lucide-react';
import { useState } from 'react';
import { Brand } from '../../components/ui';

const chapters = [
  {
    tab: 'Plan your semester',
    title: 'A little breathing room.',
    label: 'YOUR WEEKLY SPENDING PLAN',
    amount: '$128',
    suffix: '.50',
    note: 'For the coffee dates. And everything after.',
    bottom: 'Your essentials, accounted for.',
    icon: Sprout,
  },
  {
    tab: 'Find your next step',
    title: 'Possibility, on your radar.',
    label: 'MAKE ROOM FOR YOUR NEXT CHAPTER',
    amount: 'Explore',
    suffix: '',
    note: 'Campus jobs, funding, and people who can help.',
    bottom: 'TMU opportunities, all in one place.',
    icon: GraduationCap,
  },
  {
    tab: 'Grow your goals',
    title: 'Small steps. Real progress.',
    label: 'A LITTLE SET ASIDE FOR YOURSELF',
    amount: '$750',
    suffix: '',
    note: 'Build the buffer that lets you say yes.',
    bottom: 'Every little contribution counts.',
    icon: Sprout,
  },
];
export function AuthShowcase() {
  const [chapter, setChapter] = useState(0);
  const reduced = useReducedMotion();
  const item = chapters[chapter];
  return (
    <section className="auth-story" aria-label="A calmer way to plan student life">
      <div className="auth-topography" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
        <i />
      </div>
      <header className="auth-story-header">
        <Brand light />
        <span className="auth-edition">THE STUDENT EDITION</span>
      </header>
      <div className="auth-story-content">
        <motion.div
          initial={reduced ? false : { y: 14 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.65 }}
        >
          <span className="auth-kicker">
            <span /> ROOM FOR WHAT MATTERS
          </span>
          <h2>
            More life.
            <br />
            <em>Less money worry.</em>
          </h2>
          <p>
            Your semester, your money, your next big thing.
            <br className="auth-desktop-break" /> A little clarity makes room for all of it.
          </p>
        </motion.div>
        <div className="auth-preview-wrap">
          <span className="auth-preview-caption">
            A GLIMPSE OF YOUR NEXT CHAPTER <ArrowUpRight size={14} />
          </span>
          <AnimatePresence mode="wait">
            <motion.div
              className="auth-preview"
              key={chapter}
              initial={reduced ? false : { y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduced ? 0 : 0.22 }}
            >
              <div className="auth-preview-heading">
                <span className="auth-preview-icon">
                  <item.icon size={20} />
                </span>
                <strong>{item.title}</strong>
                <span className="auth-sample-label">Illustration</span>
              </div>
              <div className="auth-preview-body">
                <span>{item.label}</span>
                <div className="auth-preview-number">
                  {item.amount}
                  <small>{item.suffix}</small>
                </div>
                <p>{item.note}</p>
              </div>
              <div className={`auth-preview-track chapter-${chapter}`} aria-hidden="true">
                {Array.from({ length: 24 }, (_, i) => (
                  <i key={i} />
                ))}
              </div>
              <div className="auth-preview-bottom">
                <Check size={14} />
                {item.bottom}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="auth-chapters" aria-label="Explore Surplus features">
          {chapters.map((c, i) => (
            <button
              type="button"
              aria-pressed={chapter === i}
              onClick={() => setChapter(i)}
              key={c.tab}
            >
              <span>0{i + 1}</span>
              {c.tab}
            </button>
          ))}
        </div>
      </div>
      <footer className="auth-story-footer">
        <span>Made for student life.</span>
        <span>
          A little more surplus. <Sprout size={16} />
        </span>
      </footer>
    </section>
  );
}
