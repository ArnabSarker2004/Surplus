import { useCallback, useEffect, useRef, useState } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { CheckCircle2, Landmark, LockKeyhole, RefreshCw, Unplug } from 'lucide-react';
import type { Account, AppState } from '../../../../shared/schema';
import { api } from '../../lib';
import { Badge, Button, Modal } from '../../components/ui';
import { cad } from '../../../../shared/finance';
import './banking.css';

interface BankStatus {
  configured: boolean;
  productionConfigured: boolean;
  connected: boolean;
  environment: 'sandbox' | 'production';
  source: 'sandbox' | 'live';
  accounts: Account[];
  syncedAt: string | null;
  error: string | null;
}

function LinkSession({
  token,
  onSuccess,
  onExit,
}: {
  token: string;
  onSuccess: (token: string) => void;
  onExit: (error?: string) => void;
}) {
  const opened = useRef(false);
  const { open, ready, error } = usePlaidLink({
    token,
    onSuccess,
    onExit: (error) =>
      onExit(
        error
          ? 'The bank connection could not finish. Please try again or choose another bank.'
          : undefined,
      ),
  });
  useEffect(() => {
    if (ready && !opened.current) {
      opened.current = true;
      open();
    }
  }, [ready, open]);
  useEffect(() => {
    if (error) onExit('Plaid could not load. Please try again.');
  }, [error, onExit]);
  return <p role="status">Opening the secure bank picker…</p>;
}

export function BankConnection({
  onChange,
  onBusy,
}: {
  onChange?: (state: AppState, source: 'sandbox' | 'live' | 'manual') => void;
  onBusy?: (busy: boolean) => void;
}) {
  const [status, setStatus] = useState<BankStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [session, setSession] = useState<{
    token: string;
    update: boolean;
    environment: 'sandbox' | 'production';
  } | null>(null);
  const [confirm, setConfirm] = useState(false);
  const load = useCallback(async () => {
    const next = await api<BankStatus>('/plaid/status');
    setStatus(next);
    return next;
  }, []);
  useEffect(() => {
    void load().catch(() =>
      setError('Bank connection status is unavailable. You can continue setup manually.'),
    );
  }, [load]);
  useEffect(() => {
    onBusy?.(busy || !!session);
  }, [busy, session, onBusy]);
  const sync = async (source: 'sandbox' | 'live') => {
    const state = await api<AppState>('/plaid/sync', 'POST', {});
    onChange?.(state, source);
    await load();
    const count = state.transactions.filter((transaction) => transaction.source === source).length;
    setMessage(
      count
        ? `Sync complete. ${count} transactions are ready for your spending insights.`
        : 'Sync complete. Your bank may still be preparing history. Use Sync transactions again shortly.',
    );
  };
  const run = async (work: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await work();
    } catch (e) {
      setError((e as Error).message);
      await load().catch(() => {});
    } finally {
      setBusy(false);
    }
  };
  const start = (environment: 'sandbox' | 'production', update = false) =>
    void run(async () => {
      const result = await api<{ linkToken: string }>('/plaid/link-token', 'POST', {
        environment,
        update,
      });
      setSession({ token: result.linkToken, environment, update });
    });
  const exit = useCallback((reason?: string) => {
    setSession(null);
    if (reason) setError(reason);
    else setMessage('Connection cancelled. You can try again whenever you’re ready.');
  }, []);
  const live = status?.environment === 'production';
  return (
    <section className="bank-panel" aria-label="Bank connection">
      <div className="bank-panel-heading">
        <span className="bank-symbol">
          <Landmark size={25} />
        </span>
        <div>
          <h3>Your spending, connected.</h3>
          <p>Link a Canadian bank to bring transactions into your plan.</p>
        </div>
        <Badge tone={status?.connected ? 'green' : 'neutral'}>
          {status?.connected ? (live ? 'Live bank' : 'Sandbox') : 'Optional'}
        </Badge>
      </div>
      {error && (
        <div role="alert" className="form-error">
          <p>{error}</p>
          {!status && (
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await load();
                })
              }
            >
              Retry connection status
            </Button>
          )}
        </div>
      )}
      {message && (
        <p role="status" className="inline-notice">
          {message}
        </p>
      )}
      {status?.error && <p className="inline-notice">{status.error}</p>}
      {status?.connected ? (
        <>
          <div className="bank-connected">
            <CheckCircle2 size={19} />
            <div>
              <strong>{live ? 'Your bank is connected' : 'Test bank connected'}</strong>
              <p>
                {status.syncedAt
                  ? `Last synced ${new Date(status.syncedAt).toLocaleString()}`
                  : 'Ready for your first transaction sync.'}
              </p>
            </div>
          </div>
          <div className="bank-account-list">
            {status.accounts?.map((account) => (
              <div key={account.id}>
                <div>
                  <strong>{account.name}</strong>
                  <small>
                    {account.subtype || account.type} · {live ? 'Live' : 'Test'} account
                  </small>
                </div>
                <strong>
                  {account.currency === 'CAD'
                    ? cad(account.balance, true)
                    : `${account.balance.toFixed(2)} ${account.currency}`}
                </strong>
              </div>
            ))}
          </div>
          <div className="button-row wrap">
            <Button
              type="button"
              disabled={busy || !!session}
              onClick={() => void run(() => sync(status.source))}
            >
              <RefreshCw size={16} className={busy ? 'spin' : ''} />
              {busy ? 'Updating…' : 'Sync transactions'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={busy || !!session}
              onClick={() => start(status.environment, true)}
            >
              Reconnect bank
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={busy || !!session}
              onClick={() => setConfirm(true)}
            >
              <Unplug size={16} />
              Disconnect
            </Button>
          </div>
          <p className="field-note">
            One bank connection at a time; multiple accounts from that bank are supported. Sync
            retrieves available history. It does not instantly refresh the bank.
          </p>
        </>
      ) : (
        <>
          <ol className="bank-benefits">
            <li>
              <span>01</span>
              <div>
                <strong>Choose your bank</strong>
                <small>Find your institution in Plaid’s secure bank picker.</small>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <strong>Choose what to share</strong>
                <small>Sign in with your bank and approve account access.</small>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <strong>Understand your spending</strong>
                <small>Bring balances and transactions into your dashboard.</small>
              </div>
            </li>
          </ol>
          <Button
            type="button"
            disabled={!status?.productionConfigured || busy || !!session}
            onClick={() => start('production')}
          >
            <Landmark size={17} />
            {busy ? 'Preparing connection…' : 'Connect my bank'}
          </Button>
          {!status?.productionConfigured && (
            <p className="field-note">
              {status
                ? 'Live banking is not configured yet. You can keep planning manually.'
                : 'Checking available connections…'}
            </p>
          )}
          <p className="field-note">
            Browse supported Canadian banks in Plaid. You choose which accounts to share. No bank
            connection is required to finish setup.
          </p>
          <p className="bank-card-note">
            Connecting a credit card? Choose the bank that issued it and share the credit account
            when available. You don’t enter a card number, expiry date, or CVV in Surplus.
          </p>
          {status?.configured && (
            <details className="bank-test-options">
              <summary>Try a test connection instead</summary>
              <p>Sandbox uses fictional transactions, separate from your own spending.</p>
              <div className="button-row wrap">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy || !!session}
                  onClick={() => start('sandbox')}
                >
                  Open Sandbox bank picker
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy || !!session}
                  onClick={() =>
                    void run(async () => {
                      const result = await api<AppState>('/plaid/student', 'POST', {});
                      onChange?.(result, 'sandbox');
                      await load();
                      await sync('sandbox');
                    })
                  }
                >
                  Use student test account
                </Button>
              </div>
            </details>
          )}
        </>
      )}
      {session && (
        <Button type="button" variant="ghost" onClick={() => exit()}>
          Cancel bank connection
        </Button>
      )}
      {session && (
        <LinkSession
          key={session.token}
          token={session.token}
          onExit={exit}
          onSuccess={(token) => {
            const flow = session;
            setSession(null);
            void run(async () => {
              const source = flow.environment === 'production' ? 'live' : 'sandbox';
              if (!flow.update) {
                const result = await api<AppState>('/plaid/exchange', 'POST', {
                  publicToken: token,
                });
                onChange?.(result, source);
              }
              await load();
              await sync(source);
            });
          }}
        />
      )}
      <p className="bank-privacy">
        <LockKeyhole size={14} />
        Bank sign-in happens through Plaid or your bank. Access tokens stay encrypted on the server.
        Deposits are not added twice as planned funding.
      </p>
      {confirm && (
        <Modal title="Disconnect this bank?" onClose={() => setConfirm(false)}>
          <p>
            This removes imported transactions and accounts. Your semester plan stays. For a live
            connection, Surplus also revokes the Plaid connection.
          </p>
          <div className="modal-actions">
            <Button type="button" variant="secondary" onClick={() => setConfirm(false)}>
              Keep connected
            </Button>
            <Button
              type="button"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const result = await api<AppState>('/plaid/item', 'DELETE');
                  onChange?.(result, 'manual');
                  await load();
                  setConfirm(false);
                  setMessage('Bank disconnected. Your semester plan is kept.');
                })
              }
            >
              Disconnect bank
            </Button>
          </div>
        </Modal>
      )}
    </section>
  );
}
