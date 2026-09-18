import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  GraduationCap,
  Leaf,
  ShieldCheck,
  Sparkles,
  Sprout,
} from 'lucide-react';
import { motion } from 'motion/react';
import { Brand, Button } from '../components/ui';

export function Welcome({
  onStart,
  onDemo,
  busy,
}: {
  onStart: () => void;
  onDemo: () => void;
  busy: boolean;
}) {
  return (
    <div className="welcome">
      <header className="welcome-nav">
        <Brand />
        <span className="welcome-nav-note">Made for the student chapter.</span>
        <Button variant="ghost" onClick={onDemo} disabled={busy}>
          Explore the demo <ArrowUpRight size={16} />
        </Button>
      </header>
      <main className="welcome-main" id="main-content" tabIndex={-1}>
        <motion.div
          className="welcome-copy"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <span className="pill-eyebrow">
            <span /> A little clarity. A lot of possibility.
          </span>
          <h1>
            Your semester.
            <br />
            With room
            <br />
            to <em>grow.</em>
            <span className="heading-spark">✳</span>
          </h1>
          <p>
            Big plans, student budget. Get a clear picture of your money, find opportunities, and
            make space for what comes next.
          </p>
          <div className="welcome-actions">
            <Button onClick={onStart}>
              Set up my semester <ArrowRight size={18} />
            </Button>
            <Button variant="secondary" onClick={onDemo} disabled={busy}>
              {busy ? 'Opening your semester…' : 'Try the TMU demo'}
            </Button>
          </div>
          <div className="privacy-line">
            <ShieldCheck size={16} />
            <span>No bank connection needed. Your saved plan belongs to your account.</span>
          </div>
        </motion.div>
        <motion.div
          className="welcome-art"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          aria-label="An illustration of student funding growing into a semester plan"
        >
          <div className="art-grain" />
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="art-title">
            GOOD THINGS
            <br />
            GROW FROM A PLAN.
          </div>
          <div className="art-star">✳</div>
          <div className="art-step step-one">
            <span>01 / UNDERSTAND</span>
          </div>
          <div className="art-step step-two">
            <span>02 / MAKE A PLAN</span>
          </div>
          <div className="art-step step-three">
            <Sprout size={54} strokeWidth={1.1} />
            <span>03 / FIND YOUR ROOM</span>
          </div>
          <motion.div
            className="floating-note funding-note"
            initial={{ y: 10 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <span className="note-icon">
              <GraduationCap size={20} />
            </span>
            <div>
              <small>Your semester funding</small>
              <strong>A clearer starting point.</strong>
            </div>
            <Check size={16} />
          </motion.div>
          <div className="floating-note growth-note">
            <div className="growth-icon">
              <Leaf size={19} />
            </div>
            <div>
              <small>One small step today.</small>
              <strong>More possibilities tomorrow.</strong>
            </div>
          </div>
          <div className="art-caption">
            A PLAN THAT SEES THE WHOLE PICTURE <ArrowDown size={14} />
          </div>
        </motion.div>
      </main>
      <section className="welcome-benefits">
        <div>
          <span>01</span>
          <BookOpen size={21} />
          <div>
            <h3>See your whole semester</h3>
            <p>Tuition, funding, and the everyday stuff.</p>
          </div>
        </div>
        <div>
          <span>02</span>
          <Sparkles size={21} />
          <div>
            <h3>Find your next opportunity</h3>
            <p>Connect your skills with possibilities.</p>
          </div>
        </div>
        <div>
          <span>03</span>
          <Sprout size={21} />
          <div>
            <h3>Build a little breathing room</h3>
            <p>Small, practical steps toward your goals.</p>
          </div>
        </div>
      </section>
      <footer className="welcome-footer">
        <span>Thoughtfully built for students. Starting at TMU.</span>
        <span>Local-first · CAD · Your private student space</span>
      </footer>
    </div>
  );
}
