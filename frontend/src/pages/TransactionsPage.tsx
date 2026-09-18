import { ArrowLeft, ArrowRight, Pencil, Search } from 'lucide-react';
import { useState } from 'react';
import { asOf, cad, classify, totals } from '../../../shared/finance';
import {
  categories,
  type AppState,
  type Category,
  type Classification,
  type Transaction,
} from '../../../shared/schema';
import {
  Amount,
  Badge,
  Button,
  Empty,
  Field,
  Modal,
  PageHead,
  TransactionIcon,
} from '../components/ui';
import { api, useApp } from '../lib';

export function TransactionsPage() {
  const { state, w, refresh, notify, navigate, demo } = useApp();
  const [search, setSearch] = useState('');
  const [month, setMonth] = useState(asOf(w).slice(0, 7));
  const [category, setCategory] = useState('');
  const [account, setAccount] = useState('');
  const [type, setType] = useState('');
  const [page, setPage] = useState(0);
  const [tx, setTx] = useState<Transaction | null>(null);
  const [rule, setRule] = useState(false);
  const [saving, setSaving] = useState(false);
  const months = [...new Set(state.transactions.map((t) => t.date.slice(0, 7)))].sort().reverse();
  if (!months.includes(month) && month) months.unshift(month);
  const filtered = state.transactions.filter(
    (t) =>
      (!month || t.date.startsWith(month)) &&
      (!category || t.category === category) &&
      (!account || t.accountId === account) &&
      (!type ||
        (type === 'income'
          ? t.classification === 'Income'
          : type === 'expense'
            ? t.cashFlow < 0 && t.classification !== 'Transfer'
            : type === 'pending'
              ? t.pending
              : t.classification === 'Transfer')) &&
      `${t.merchant} ${t.description}`.toLowerCase().includes(search.toLowerCase()),
  );
  const stats = totals(filtered);
  const pageCount = Math.ceil(filtered.length / 15);
  const safePage = Math.min(page, Math.max(0, pageCount - 1));
  return (
    <>
      <PageHead
        eyebrow="YOUR TRANSACTIONS"
        title="Every little thing, in view."
        description="Understand the everyday. Give every transaction the right home."
        action={
          <div className="button-row">
            <Badge>{state.transactions.length} transactions</Badge>
            <Button variant="secondary" onClick={() => navigate('settings')}>
              Connect or manage bank
            </Button>
          </div>
        }
      />
      <div className="mini-stats standalone">
        <div>
          <small>Filtered income</small>
          <strong className="positive">{cad(stats.income, true)}</strong>
        </div>
        <div>
          <small>Filtered spending</small>
          <strong>{cad(stats.spending, true)}</strong>
        </div>
        <div>
          <small>Net cash flow</small>
          <strong>{cad(stats.net, true)}</strong>
        </div>
        <div>
          <small>Net / income</small>
          <strong>{stats.savingsRate}%</strong>
        </div>
      </div>
      <section className="card transaction-card">
        <div className="transaction-filters">
          <div className="search-field">
            <Search size={17} />
            <input
              aria-label="Search transactions"
              placeholder="Search a merchant or description"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
            />
          </div>
          <select
            aria-label="Filter month"
            value={month}
            onChange={(e) => {
              setMonth(e.target.value);
              setPage(0);
            }}
          >
            <option value="">All months</option>
            {months.map((m) => (
              <option key={m} value={m}>
                {new Date(m + '-01T12:00:00').toLocaleDateString('en', {
                  month: 'long',
                  year: 'numeric',
                })}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter category"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(0);
            }}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select
            aria-label="Filter account"
            value={account}
            onChange={(e) => setAccount(e.target.value)}
          >
            <option value="">All accounts</option>
            {state.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter transaction type"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="">All activity</option>
            <option value="income">Income</option>
            <option value="expense">Expenses</option>
            <option value="transfer">Transfers</option>
            <option value="pending">Pending</option>
          </select>
        </div>
        {filtered.length ? (
          <>
            <div className="table-scroll">
              <table className="transaction-table">
                <thead>
                  <tr>
                    <th>Transaction</th>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Classification</th>
                    <th className="align-right">Amount</th>
                    <th>
                      <span className="sr-only">Edit</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(safePage * 15, safePage * 15 + 15).map((t) => (
                    <tr key={t.id}>
                      <td>
                        <div className="merchant-cell">
                          <TransactionIcon
                            income={t.classification === 'Income'}
                            transfer={t.classification === 'Transfer'}
                          />
                          <div>
                            <strong>{t.merchant}</strong>
                            <small>
                              {state.accounts.find((a) => a.id === t.accountId)?.name ?? 'Account'}
                              {t.pending ? ' · Pending' : ''}
                              {t.userCorrected ? ' · Edited' : ''}
                            </small>
                          </div>
                        </div>
                      </td>
                      <td className="muted nowrap">
                        {new Date(t.date + 'T12:00:00').toLocaleDateString('en-CA', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                      <td>
                        <span className="category-chip">{t.category}</span>
                      </td>
                      <td>
                        <Badge tone={t.classification === 'Review' ? 'amber' : 'neutral'}>
                          {t.classification}
                        </Badge>
                      </td>
                      <td className="align-right nowrap">
                        {t.currency === 'CAD' ? (
                          <Amount value={t.cashFlow} flow />
                        ) : (
                          <span>
                            {t.cashFlow.toFixed(2)} {t.currency}
                          </span>
                        )}
                      </td>
                      <td>
                        <button
                          className="icon-button"
                          aria-label={`Edit ${t.merchant} on ${t.date}`}
                          onClick={() => {
                            setTx(t);
                            setRule(false);
                          }}
                        >
                          <Pencil size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pagination">
              <span>
                {filtered.length} results · Page {safePage + 1} of {pageCount}
              </span>
              <div>
                <button
                  className="icon-button"
                  aria-label="Previous transaction page"
                  disabled={safePage === 0}
                  onClick={() => setPage(safePage - 1)}
                >
                  <ArrowLeft size={17} />
                </button>
                <button
                  className="icon-button"
                  aria-label="Next transaction page"
                  disabled={safePage + 1 >= pageCount}
                  onClick={() => setPage(safePage + 1)}
                >
                  <ArrowRight size={17} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <Empty
            title="Nothing in this view just yet."
            detail="Try another month or clear your filters."
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  setSearch('');
                  setMonth('');
                  setCategory('');
                  setAccount('');
                  setType('');
                }}
              >
                Clear filters
              </Button>
            }
          />
        )}
      </section>
      <p className="field-note">
        CAD totals exclude pending transactions and other currencies. Transfers, investment
        contributions, and credit-card payments are not new spending. Refunds reduce their original
        spending category. Review uncategorized deposits and cash withdrawals before relying on
        totals.
      </p>
      {tx && (
        <Modal title="Give it the right home" onClose={() => setTx(null)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setSaving(true);
              try {
                if (demo) {
                  refresh({
                    ...state,
                    transactions: state.transactions.map((item) =>
                      item.id === tx.id || (rule && item.merchant === tx.merchant)
                        ? { ...item, category: tx.category, classification: tx.classification }
                        : item,
                    ),
                  });
                } else
                  refresh(
                    await api<AppState>(`/transactions/${encodeURIComponent(tx.id)}`, 'PATCH', {
                      category: tx.category,
                      classification: tx.classification,
                      saveRule: rule,
                    }),
                  );
                notify(rule ? 'Category updated and merchant rule saved.' : 'Transaction updated.');
                setTx(null);
              } catch (e) {
                notify((e as Error).message, true);
              } finally {
                setSaving(false);
              }
            }}
          >
            <p>
              {tx.merchant} · {tx.date} · {cad(tx.cashFlow, true)}
            </p>
            <div className="form-stack">
              <Field label="Category">
                <select
                  value={tx.category}
                  onChange={(e) =>
                    setTx({
                      ...tx,
                      category: e.target.value as Category,
                      classification: classify(e.target.value as Category, tx.cashFlow),
                    })
                  }
                >
                  {categories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="Spending classification">
                <select
                  value={tx.classification}
                  onChange={(e) =>
                    setTx({ ...tx, classification: e.target.value as Classification })
                  }
                >
                  {['Essential', 'Flexible', 'Discretionary', 'Transfer', 'Income', 'Review'].map(
                    (c) => (
                      <option key={c}>{c}</option>
                    ),
                  )}
                </select>
              </Field>
              <label className="checkbox-line">
                <input type="checkbox" checked={rule} onChange={(e) => setRule(e.target.checked)} />{' '}
                Apply to future transactions and other uncorrected transactions from this merchant
              </label>
              <p className="field-note">Original bank categories and amounts are preserved.</p>
            </div>
            <div className="modal-actions">
              <Button type="button" variant="ghost" onClick={() => setTx(null)}>
                Cancel
              </Button>
              <Button disabled={saving}>Save category</Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
