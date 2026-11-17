import { ArrowLeft, ArrowRight, ChevronDown, MoreHorizontal, Search } from 'lucide-react';
import { Fragment, useRef, useState } from 'react';
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
import {
  detailOptions,
  merchantDetails,
  merchantEvidence,
  merchantName,
  merchantRuleKey,
  transactionDetail,
  automaticMerchant,
} from '../../../shared/merchants';
import { MerchantEvidence } from '../features/transactions/MerchantEvidence';
import { TransactionContext } from '../features/transactions/TransactionContext';
import { MerchantEnrichment, EnrichmentSummary } from '../features/transactions/MerchantEnrichment';
import { splitsMatch } from '../../../shared/transaction-review';
import { reviewReasons } from '../../../shared/transaction-review';
import { QuickTransactionEdit } from '../features/transactions/QuickTransactionEdit';
import { applyAutomaticCleanup } from '../../../shared/transaction-cleanup';
import { DepositReview } from '../features/transactions/DepositReview';
import { depositSource } from '../../../shared/deposits';
import { studentFunding } from '../../../shared/student-funding';
import {
  EducationFundingSummary,
  StudentFundingTag,
  StudentFundingDetails,
} from '../features/transactions/StudentFunding';
import '../features/transactions/transactions.css';

export function TransactionsPage() {
  const { state, w, refresh, notify, navigate, demo } = useApp();
  const [search, setSearch] = useState('');
  const [month, setMonth] = useState(asOf(w).slice(0, 7));
  const [category, setCategory] = useState('');
  const [account, setAccount] = useState('');
  const [type, setType] = useState('');
  const [identity, setIdentity] = useState('');
  const [funding, setFunding] = useState('');
  const [page, setPage] = useState(0);
  const [tx, setTx] = useState<Transaction | null>(null);
  const [depositToReview, setDepositToReview] = useState<Transaction | null>(null);
  const [quickEdit, setQuickEdit] = useState<string | null>(null);
  const [focusCategory, setFocusCategory] = useState(false);
  const editTrigger = useRef<HTMLButtonElement | null>(null);
  const closeQuickEdit = () => {
    setQuickEdit(null);
    editTrigger.current?.focus();
  };
  const [rule, setRule] = useState(false);
  const [saving, setSaving] = useState(false);
  const months = [...new Set(state.transactions.map((t) => t.date.slice(0, 7)))].sort().reverse();
  if (!months.includes(month) && month) months.unshift(month);
  const filtered = state.transactions
    .map(applyAutomaticCleanup)
    .filter(
      (t) =>
        (!month || t.date.startsWith(month)) &&
        (!category || t.category === category) &&
        (!account || t.accountId === account) &&
        (!funding ||
          (funding === 'all' ? !!studentFunding(t) : studentFunding(t)?.kind === funding)) &&
        (!identity ||
          (identity === 'confirmed'
            ? !!t.merchantOverride || ['HIGH', 'VERY_HIGH'].includes(merchantDetails(t).confidence)
            : identity === 'automatic'
              ? !!automaticMerchant(t) || t.categoryOrigin === 'enrichment'
              : reviewReasons(t).length > 0)) &&
        (!type ||
          (type === 'needs-source'
            ? !t.pending && depositSource(t) === 'unknown'
            : type === 'non-salary'
              ? !['salary', 'transfer', null].includes(depositSource(t))
              : type === 'income'
                ? t.classification === 'Income'
                : type === 'expense'
                  ? t.cashFlow < 0 && t.classification !== 'Transfer'
                  : type === 'pending'
                    ? t.pending
                    : t.classification === 'Transfer')) &&
        `${merchantName(t)} ${t.merchant} ${t.description} ${transactionDetail(t)?.label || ''}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    );
  const stats = totals(filtered);
  const pageCount = Math.ceil(filtered.length / 15);
  const safePage = Math.min(page, Math.max(0, pageCount - 1));
  return (
    <>
      <PageHead
        eyebrow="YOUR TRANSACTIONS"
        title="Every little thing, in view."
        description="OSAP and RESP deposits are detected from bank labels. Select a name or category to correct it."
        action={
          <div className="button-row">
            <Badge>{state.transactions.length} transactions</Badge>
            <Button variant="secondary" onClick={() => navigate('settings')}>
              Connect or manage bank
            </Button>
            {state.transactions.some((t) => !t.pending && depositSource(t) === 'unknown') && (
              <Button
                variant="secondary"
                onClick={() => {
                  setMonth('');
                  setCategory('');
                  setAccount('');
                  setSearch('');
                  setIdentity('');
                  setFunding('');
                  setType('needs-source');
                  setPage(0);
                }}
              >
                Review unclear deposits
              </Button>
            )}
          </div>
        }
      />
      <div className="mini-stats standalone">
        <div>
          <small>Money in · includes funding</small>
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
          <small>Net / money in</small>
          <strong>{stats.savingsRate}%</strong>
        </div>
      </div>
      <EducationFundingSummary transactions={filtered} onReview={() => navigate('semester')} />
      <DepositReview
        transactions={filtered}
        accounts={state.accounts}
        onReview={setDepositToReview}
      />
      <MerchantEnrichment />
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
            <option value="income">Money in (including funding)</option>
            <option value="non-salary">Non-salary deposits</option>
            <option value="needs-source">Deposits needing source review</option>
            <option value="expense">Expenses</option>
            <option value="transfer">Transfers</option>
            <option value="pending">Pending</option>
          </select>
          <select
            aria-label="Filter education funding"
            value={funding}
            onChange={(e) => {
              setFunding(e.target.value);
              setPage(0);
            }}
          >
            <option value="">All funding sources</option>
            <option value="all">Education funding only</option>
            <option value="osap">OSAP deposits</option>
            <option value="resp">RESP deposits</option>
            <option value="student-aid">Other student aid</option>
          </select>
          <select
            aria-label="Company identification"
            value={identity}
            onChange={(e) => {
              setIdentity(e.target.value);
              setPage(0);
            }}
          >
            <option value="">All company matches</option>
            <option value="confirmed">Strong / user-confirmed matches</option>
            <option value="automatic">Automatically cleaned</option>
            <option value="review">Needs a quick check</option>
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
                      <span className="sr-only">Details</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(safePage * 15, safePage * 15 + 15).map((t) => (
                    <Fragment key={t.id}>
                      <tr>
                        <td>
                          <div className="merchant-cell">
                            <TransactionIcon
                              income={t.classification === 'Income'}
                              transfer={t.classification === 'Transfer'}
                            />
                            <div>
                              <button
                                type="button"
                                className="transaction-name-button"
                                aria-label={`Quick edit ${merchantName(t)} on ${t.date}`}
                                aria-expanded={quickEdit === t.id}
                                onClick={(e) => {
                                  editTrigger.current = e.currentTarget;
                                  setFocusCategory(false);
                                  setQuickEdit(quickEdit === t.id ? null : t.id);
                                }}
                              >
                                {merchantName(t)}
                              </button>
                              <small className="merchant-evidence-label">
                                {merchantEvidence(t)}
                              </small>
                              <small>
                                {state.accounts.find((a) => a.id === t.accountId)?.name ??
                                  'Account'}
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
                          <button
                            type="button"
                            className="category-chip transaction-category-button"
                            aria-label={`Change category for ${merchantName(t)} on ${t.date}`}
                            aria-expanded={quickEdit === t.id}
                            onClick={(e) => {
                              editTrigger.current = e.currentTarget;
                              setFocusCategory(true);
                              setQuickEdit(quickEdit === t.id ? null : t.id);
                            }}
                          >
                            {t.category}
                            <ChevronDown size={13} aria-hidden="true" />
                          </button>
                          {t.categoryOrigin === 'enrichment' && (
                            <small className="transaction-subcategory">
                              Auto-categorized · editable
                            </small>
                          )}
                          <StudentFundingTag transaction={t} />
                          {transactionDetail(t) && (
                            <small className="transaction-subcategory">
                              {transactionDetail(t)!.label}
                            </small>
                          )}
                        </td>
                        <td>
                          <Badge tone={t.classification === 'Review' ? 'amber' : 'neutral'}>
                            {studentFunding(t) ? 'Education funding' : t.classification}
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
                            aria-label={`Details for ${merchantName(t)} on ${t.date}`}
                            title="Details and split purchase"
                            onClick={() => {
                              setTx(t);
                              setQuickEdit(null);
                              setRule(false);
                            }}
                          >
                            <MoreHorizontal size={17} />
                          </button>
                        </td>
                      </tr>
                      {quickEdit === t.id && (
                        <tr className="transaction-edit-row">
                          <td colSpan={6}>
                            <QuickTransactionEdit
                              transaction={t}
                              onClose={closeQuickEdit}
                              focusCategory={focusCategory}
                              onDetails={() => {
                                setTx(t);
                                setRule(false);
                                setQuickEdit(null);
                              }}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
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
                  setIdentity('');
                  setFunding('');
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
      {depositToReview && (
        <Modal title="Identify this deposit" onClose={() => setDepositToReview(null)}>
          <QuickTransactionEdit
            transaction={depositToReview}
            focusDeposit
            onClose={() => setDepositToReview(null)}
            onDetails={() => {
              setTx(depositToReview);
              setRule(false);
              setDepositToReview(null);
            }}
          />
        </Modal>
      )}
      {tx && (
        <Modal title="Transaction details" onClose={() => setTx(null)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!splitsMatch(tx)) {
                notify('Split amounts must add up exactly to the transaction.', true);
                return;
              }
              setSaving(true);
              try {
                if (demo) {
                  refresh({
                    ...state,
                    transactions: state.transactions.map((item) =>
                      item.id === tx.id ||
                      (rule && !item.userCorrected && merchantRuleKey(item) === merchantRuleKey(tx))
                        ? {
                            ...item,
                            category: tx.category,
                            classification: tx.classification,
                            userCorrected: item.id === tx.id || item.userCorrected,
                            depositPurpose: item.category === tx.category ? item.depositPurpose : undefined,
                            ...(item.id === tx.id
                              ? { forecastTreatment: tx.forecastTreatment, splits: tx.splits }
                              : {}),
                            ...(tx.merchantCorrected
                              ? { merchantOverride: tx.merchantOverride, merchantCorrected: true }
                              : {}),
                            ...(tx.detailCategoryCorrected
                              ? { detailCategory: tx.detailCategory, detailCategoryCorrected: true }
                              : {}),
                          }
                        : item,
                    ),
                  });
                } else
                  refresh(
                    await api<AppState>(`/transactions/${encodeURIComponent(tx.id)}`, 'PATCH', {
                      category: tx.category,
                      classification: tx.classification,
                      saveRule: rule,
                      forecastTreatment: tx.forecastTreatment || 'automatic',
                      splits: tx.splits || [],
                      ...(tx.merchantCorrected
                        ? { merchantOverride: tx.merchantOverride || null }
                        : {}),
                      ...(tx.detailCategoryCorrected
                        ? { detailCategory: tx.detailCategory || null }
                        : {}),
                    }),
                  );
                notify(
                  rule
                    ? 'Transaction details updated and merchant rule saved.'
                    : 'Transaction details updated.',
                );
                setTx(null);
              } catch (e) {
                notify((e as Error).message, true);
              } finally {
                setSaving(false);
              }
            }}
          >
            <div className="transaction-detail-head">
              <div>
                <span className="eyebrow">COMPANY / MERCHANT</span>
                <h3>{merchantName(tx)}</h3>
                <Badge
                  tone={
                    tx.merchantOverride ||
                    ['HIGH', 'VERY_HIGH'].includes(merchantDetails(tx).confidence)
                      ? 'green'
                      : 'amber'
                  }
                >
                  {merchantEvidence(tx)}
                </Badge>
              </div>
              <div>
                <strong>
                  {tx.currency === 'CAD'
                    ? cad(tx.cashFlow, true)
                    : `${tx.cashFlow.toFixed(2)} ${tx.currency}`}
                </strong>
                <small>
                  {tx.date}
                  {tx.pending ? ' · Pending' : ' · Posted'}
                </small>
              </div>
            </div>
            <MerchantEvidence transaction={tx} />
            <StudentFundingDetails transaction={tx} />
            <EnrichmentSummary transaction={tx} />
            <div className="form-stack">
              <Field
                label="Correct company name"
                hint="Optional. Leave blank to use the bank match. This confirms a trading name, not a legal parent company."
              >
                <input
                  value={tx.merchantOverride || ''}
                  maxLength={160}
                  placeholder={merchantName(tx)}
                  onChange={(e) =>
                    setTx({
                      ...tx,
                      merchantOverride: e.target.value || null,
                      merchantCorrected: true,
                    })
                  }
                />
              </Field>
              <Field label="Category">
                <select
                  value={tx.category}
                  onChange={(e) =>
                    setTx({
                      ...tx,
                      category: e.target.value as Category,
                      classification: classify(e.target.value as Category, tx.cashFlow),
                      detailCategory: null,
                      detailCategoryCorrected: true,
                    })
                  }
                >
                  {categories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field
                label="Detailed category"
                hint="Only details compatible with the selected category are offered."
              >
                <select
                  value={transactionDetail(tx)?.code || ''}
                  onChange={(e) =>
                    setTx({
                      ...tx,
                      detailCategory: e.target.value || null,
                      detailCategoryCorrected: true,
                    })
                  }
                >
                  <option value="">No confirmed detail</option>
                  {detailOptions(tx.category).map((d) => (
                    <option key={d.code} value={d.code}>
                      {d.label}
                    </option>
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
              <TransactionContext transaction={tx} change={setTx} />
              <label className="checkbox-line">
                <input
                  type="checkbox"
                  checked={rule}
                  disabled={!merchantRuleKey(tx)}
                  onChange={(e) => setRule(e.target.checked)}
                />{' '}
                Apply to future transactions and other uncorrected transactions from this merchant
              </label>
              {!merchantRuleKey(tx) && (
                <p className="field-note">
                  This descriptor may cover several companies. Your correction applies to this
                  purchase only, so a PayPal or Square payment is not mistaken for every seller
                  using that processor.
                </p>
              )}
              <div className="transaction-model-preview">
                <strong>How forecasts use this purchase</strong>
                <dl>
                  <div>
                    <dt>Company label</dt>
                    <dd>{merchantName(tx)}</dd>
                  </div>
                  <div>
                    <dt>Spending detail</dt>
                    <dd>
                      {tx.category}
                      {transactionDetail(tx) ? ` / ${transactionDetail(tx)!.label}` : ''}
                    </dd>
                  </div>
                  <div>
                    <dt>Cash-flow treatment</dt>
                    <dd>
                      {tx.pending
                        ? 'Pending: reserved, not training data'
                        : tx.currency !== 'CAD'
                          ? 'Excluded from CAD models'
                          : tx.classification === 'Transfer'
                            ? 'Transfer: excluded from spending'
                            : tx.classification === 'Review'
                              ? 'Needs review; unknown deposits are not projected as pay'
                              : tx.classification}
                    </dd>
                  </div>
                </dl>
              </div>
              <p className="field-note">Original bank categories and amounts are preserved.</p>
            </div>
            <div className="modal-actions">
              <Button type="button" variant="ghost" onClick={() => setTx(null)}>
                Cancel
              </Button>
              <Button disabled={saving}>Save transaction</Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
