import { Download, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { AppState } from '../../../shared/schema';
import { Badge, Button, Modal, PageHead, SectionTitle } from '../components/ui';
import { api, useApp } from '../lib';
import { useAuth } from '../features/auth/AuthGate';
import { LogoutButton } from '../features/auth/LogoutButton';
import { BankConnection } from '../features/banking/BankConnection';
import { SignInSettings } from '../features/auth/SignInSettings';

export function SettingsPage({
  onDemo,
  onNew,
}: {
  onDemo: () => Promise<void>;
  onNew: () => void;
}) {
  const { w, refresh, notify, edit, save } = useApp();
  const { username, draftKey } = useAuth();
  const [working, setWorking] = useState(false);
  const [confirm, setConfirm] = useState<'delete' | 'demo' | null>(null);
  const action = async (path: string, body: unknown = {}, method = 'POST') => {
    setWorking(true);
    try {
      refresh(await api<AppState>(path, method, body));
      notify('Your data has been updated.');
      return true;
    } catch (e) {
      notify((e as Error).message, true);
      return false;
    } finally {
      setWorking(false);
    }
  };
  return (
    <>
      <PageHead
        eyebrow="YOUR SPACE, YOUR CHOICE"
        title="Make yourself at home."
        description="Manage your semester, your connections, and your saved data."
      />
      <section className="card settings-section">
        <SectionTitle
          title="Your student space"
          subtitle={`Signed in as ${username} · Your plan is saved to your account`}
          action={
            <Button variant="secondary" onClick={edit}>
              Edit profile & semester
            </Button>
          }
        />
        <div className="profile-details">
          <span className="avatar big">{w.profile.name.slice(0, 1)}</span>
          <div>
            <h3>{w.profile.name}</h3>
            <p>{w.profile.institution}</p>
            <small>
              Year {w.profile.year} · {w.profile.program} · {w.semester.name}
            </small>
          </div>
          <Badge tone="green">
            {w.source === 'demo'
              ? 'Demo data'
              : w.source === 'live'
                ? 'Live bank transactions'
                : w.source === 'sandbox'
                  ? 'Sandbox transactions'
                  : 'Manual plan'}
          </Badge>
        </div>
      </section>
      <section className="card settings-section">
        <SectionTitle
          title="Your session"
          subtitle="Log out to close access on this browser. Your saved plan and bank connection are kept for your next visit."
          action={<LogoutButton />}
        />
        <p className="field-note">
          Sessions expire after 30 minutes without API activity, or after seven days. Logging out
          also clears local onboarding drafts.
        </p>
      </section>
      <SignInSettings />
      <BankConnection
        onChange={(next, source) => {
          refresh(next);
          if (source !== 'manual' && next.workspace && next.workspace.source !== source)
            void save({ ...next.workspace, source }, 'Now showing your bank transactions.').catch(
              () => {},
            );
        }}
      />
      <section className="card settings-section">
        <SectionTitle title="Your data belongs to you." />
        <div className="settings-row">
          <div>
            <h3>Download your current workspace</h3>
            <p>Export your plan, goals, and transactions as JSON. Banking tokens are excluded.</p>
          </div>
          <a className="button secondary" href="/api/export" download>
            <Download size={16} /> Export my data
          </a>
        </div>
        <div className="settings-row">
          <div>
            <h3>Explore a fresh sample semester</h3>
            <p>
              Resets the current plan to Alex’s demo. Export your changes first if you want to keep
              them.
            </p>
          </div>
          <Button variant="secondary" onClick={() => setConfirm('demo')}>
            Reset to Demo Mode
          </Button>
        </div>
        <div className="settings-row">
          <div>
            <h3>Start your own semester</h3>
            <p>Set up a new plan with your own information.</p>
          </div>
          <Button variant="secondary" onClick={onNew}>
            Set up my semester
          </Button>
        </div>
        <div className="settings-row">
          <div>
            <h3>Delete your workspace data</h3>
            <p>
              Removes your plan, transactions, goals, notes, merchant rules, and your saved
              connection. Your login account is retained.
            </p>
          </div>
          <Button variant="ghost" className="danger-button" onClick={() => setConfirm('delete')}>
            <Trash2 size={16} /> Delete my data
          </Button>
        </div>
      </section>
      <p className="field-note">
        Financial planning is deterministic. TMU resources cite official sources; financial demo
        examples are fictional. No financial data is sent to an AI service. Your own browser may
        sync its local storage through device backups; use a trusted device.
      </p>
      {confirm && (
        <Modal
          title={confirm === 'delete' ? 'Delete your workspace?' : 'Start a fresh demo?'}
          onClose={() => setConfirm(null)}
        >
          <p>
            {confirm === 'delete'
              ? 'This permanently removes the saved plan and financial records for your account. Your login account is retained.'
              : 'Your current semester plan will be replaced by the sample. Download an export first if you want to keep it.'}
          </p>
          <div className="modal-actions">
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Keep my data
            </Button>
            <Button
              disabled={working}
              onClick={async () => {
                if (confirm === 'demo') await onDemo();
                else if (confirm === 'delete') {
                  if (!(await action('/data', undefined, 'DELETE'))) return;
                  localStorage.removeItem(draftKey);
                }
                setConfirm(null);
              }}
            >
              {confirm === 'demo' ? 'Reset demo' : 'Remove data'}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
