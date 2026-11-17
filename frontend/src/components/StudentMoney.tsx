import { useState } from 'react';
import { Flag, Minus, Equal } from 'lucide-react';
import { cad, cashBreakdown, prettyDate } from '../../../shared/finance';
import {
  depositPurposePatch,
  fundingLabels,
  fundingTypes,
  type FundingType,
} from '../../../shared/deposits';
import { merchantName } from '../../../shared/merchants';
import type { AppState, Transaction } from '../../../shared/schema';
import { api, useApp } from '../lib';
import { Button, Field, Modal, SectionTitle } from './ui';
import './student-money.css';

export function StudentMoney() {
  const { w, state, refresh, demo, notify, busy } = useApp();
  const money = cashBreakdown(w, state.accounts, state.transactions);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [account, setAccount] = useState('');
  const [view, setView] = useState('all');
  const [page, setPage] = useState(0);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const deposits = money.rows.flatMap((r) => r.deposits.map((d) => ({ ...d, account: r.account })));
  const filtered = deposits
    .filter(
      (d) =>
        (!account || d.account.id === account) &&
        (view !== 'funding' || d.fundingType) &&
        `${d.name} ${merchantName(d.transaction)} ${d.date}`
          .toLowerCase()
          .includes(search.trim().toLowerCase()),
    )
    .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  const safePage = Math.min(page, Math.max(0, Math.ceil(filtered.length / 8) - 1));
  const visible = filtered.slice(safePage * 8, safePage * 8 + 8);
  const changeSource = async (t: Transaction, purpose: FundingType | 'personal') => {
    setSaving(t.id);
    setError('');
    setMessage('');
    const patch = { ...depositPurposePatch(purpose, t), saveRule: false, detailCategory: null };
    try {
      if (demo) {
        refresh({
          ...state,
          transactions: state.transactions.map((row) =>
            row.id === t.id && row.source === t.source
              ? {
                  ...row,
                  ...patch,
                  userCorrected: true,
                  categoryOrigin: 'user',
                  detailCategoryCorrected: true,
                }
              : row,
          ),
        });
      } else {
        refresh(await api<AppState>(`/transactions/${encodeURIComponent(t.id)}`, 'PATCH', patch));
      }
      const text =
        purpose === 'personal'
          ? 'Saved as personal money. Removed from the funding deduction.'
          : `Saved as ${fundingLabels[purpose]}. Included in the funding deduction.`;
      setMessage(text);
      notify(text);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(null);
    }
  };
  return (
    <section className="card student-money" aria-label="Student money breakdown">
      <SectionTitle
        title="What’s in your balance?"
        subtitle="Your balance, minus loans and education funding."
        action={
          money.rows.length ? (
            <Button variant="secondary" onClick={() => setOpen(true)}>
              <Flag size={15} /> Manage funding
            </Button>
          ) : undefined
        }
      />
      {money.rows.length ? (
        <>
          <div className="money-summary">
            <dl>
              <dt>Account balance</dt>
              <dd>{cad(money.cash, true)}</dd>
            </dl>
            <Minus className="money-operator" size={18} aria-hidden="true" />
            <dl>
              <dt>Non-personal funds</dt>
              <dd>{cad(money.receivedFunding.total, true)}</dd>
            </dl>
            <Equal className="money-operator" size={18} aria-hidden="true" />
            <dl className="money-personal">
              <dt>Your personal money</dt>
              <dd>{cad(money.own, true)}</dd>
            </dl>
          </div>
          <p className="money-explanation">
            Everything else in your balance is personal money. Flag a deposit to include it in the
            deduction.
          </p>
          {money.receivedFunding.total > money.cash && (
            <p className="field-note">
              Funding exceeds the current balance. Your personal money is shown as $0.
            </p>
          )}
          {money.receivedFunding.total > 0 && (
            <details className="money-funding-details">
              <summary>
                Included funding · {deposits.filter((d) => d.fundingType).length} deposits
              </summary>
              <dl>
                {fundingTypes
                  .filter((type) => money.fundingTotals[type] > 0)
                  .map((type) => (
                    <div key={type}>
                      <dt>{fundingLabels[type]}</dt>
                      <dd>{cad(money.fundingTotals[type], true)}</dd>
                    </div>
                  ))}
              </dl>
              <p>Totals include all imported months. Pending deposits are excluded.</p>
            </details>
          )}
          {money.overdraft > 0 && (
            <p className="field-note">
              Overdrafts of {cad(money.overdraft, true)} also reduce your savings estimate.
            </p>
          )}
        </>
      ) : (
        <p className="field-note">Connect a CAD cash account to see your personal balance.</p>
      )}
      {money.unknownAccounts > 0 && (
        <p className="field-note">
          {money.unknownAccounts} account balance{money.unknownAccounts === 1 ? ' is' : 's are'}{' '}
          unavailable and excluded.
        </p>
      )}
      {open && (
        <Modal
          title="Manage non-personal funds"
          onClose={() => {
            if (!saving) setOpen(false);
          }}
        >
          <div className="funding-manager">
            <p>
              Mark deposits as a loan, OSAP, grant, scholarship or RESP. Choose Personal money to
              remove a deduction. Changes save automatically.
            </p>
            <div className="funding-manager-total">
              <span>
                Non-personal funds <strong>{cad(money.receivedFunding.total, true)}</strong>
              </span>
              <span>
                Your personal money <strong>{cad(money.own, true)}</strong>
              </span>
            </div>
            <div className="funding-filters">
              <Field label="Search deposits">
                <input
                  autoFocus
                  type="search"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(0);
                  }}
                  placeholder="Name, description or date"
                />
              </Field>
              <Field label="Account">
                <select
                  value={account}
                  onChange={(e) => {
                    setAccount(e.target.value);
                    setPage(0);
                  }}
                >
                  <option value="">All CAD cash accounts</option>
                  {money.rows.map((r) => (
                    <option key={r.account.id} value={r.account.id}>
                      {r.account.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Show">
                <select
                  value={view}
                  onChange={(e) => {
                    setView(e.target.value);
                    setPage(0);
                  }}
                >
                  <option value="all">All deposits</option>
                  <option value="funding">Non-personal funds</option>
                </select>
              </Field>
            </div>
            <p className="field-note">
              All imported months · Posted CAD deposits · {filtered.length} results
            </p>
            <div role="status" className="funding-save-status">
              {saving ? 'Saving…' : message}
            </div>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="funding-deposits">
              {visible.map((d) => (
                <article className="funding-deposit" key={`${d.account.id}:${d.id}`}>
                  <div className="funding-deposit-name">
                    <strong>{merchantName(d.transaction)}</strong>
                    <small>
                      {prettyDate(d.date)} · {d.date.slice(0, 4)} · {d.account.name}
                    </small>
                    {d.name !== merchantName(d.transaction) && <small>{d.name}</small>}
                  </div>
                  <strong className="funding-deposit-amount">{cad(d.amount, true)}</strong>
                  <Field
                    label={`Money type for ${d.name} on ${d.date}`}
                    className="funding-deposit-type"
                  >
                    <select
                      value={d.fundingType || 'personal'}
                      disabled={!!saving || busy || !!d.transaction.splits?.length}
                      onChange={(e) =>
                        void changeSource(d.transaction, e.target.value as FundingType | 'personal')
                      }
                    >
                      <option value="personal">Personal money</option>
                      {fundingTypes.map((type) => (
                        <option key={type} value={type}>
                          {fundingLabels[type]}
                        </option>
                      ))}
                    </select>
                  </Field>
                  {d.fundingType && (
                    <small className="funding-deposit-status">
                      {d.transaction.depositPurpose &&
                      fundingTypes.includes(d.transaction.depositPurpose as FundingType)
                        ? 'Flagged by you'
                        : 'Automatically detected from name or category'}
                    </small>
                  )}
                  {!!d.transaction.splits?.length && (
                    <small className="funding-deposit-status">
                      Edit this split in Transactions.
                    </small>
                  )}
                </article>
              ))}
              {!visible.length && <p className="funding-empty">No deposits match these filters.</p>}
            </div>
            {filtered.length > 8 && (
              <div className="funding-pagination">
                <Button
                  variant="ghost"
                  disabled={safePage === 0}
                  onClick={() => setPage(safePage - 1)}
                >
                  Previous
                </Button>
                <span>
                  {safePage * 8 + 1}–{Math.min(filtered.length, safePage * 8 + 8)} of{' '}
                  {filtered.length}
                </span>
                <Button
                  variant="ghost"
                  disabled={(safePage + 1) * 8 >= filtered.length}
                  onClick={() => setPage(safePage + 1)}
                >
                  Next
                </Button>
              </div>
            )}
            <div className="modal-actions">
              <Button disabled={!!saving} onClick={() => setOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}
