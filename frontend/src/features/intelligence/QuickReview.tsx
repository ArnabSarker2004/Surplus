import { useState } from 'react';
import { categories, type AppState, type Transaction } from '../../../../shared/schema';
import { reviewReasons, reviewQueue, splitsMatch } from '../../../../shared/transaction-review';
import { merchantName, detailOptions, transactionDetail } from '../../../../shared/merchants';
import { cad, classify } from '../../../../shared/finance';
import { api, useApp } from '../../lib';
import { Badge, Button, Field, Modal, SectionTitle } from '../../components/ui';
import { TransactionContext } from '../transactions/TransactionContext';
import { EnrichmentSummary } from '../transactions/MerchantEnrichment';
import '../transactions/transactions.css';

export function QuickReview({ asOf }: { asOf?: string }) {
  const { state, demo, refresh, notify, navigate } = useApp();
  const [skipped, skip] = useState<string[]>([]),
    [editing, edit] = useState<Transaction | null>(null),
    [saving, setSaving] = useState(false);
  const rows = reviewQueue(state.transactions, asOf).filter((t) => !skipped.includes(t.id));
  return (
    <section className="card" id="quick-review">
      <SectionTitle
        title="Transactions to review"
        subtitle={`${rows.length} unresolved · largest amounts first`}
        action={
          <Button variant="ghost" onClick={() => navigate('transactions')}>
            All transactions
          </Button>
        }
      />
      {rows.slice(0, 3).map((t) => (
        <div className="review-queue-row" key={t.id}>
          <div>
            <strong>{merchantName(t)}</strong>
            <small>
              {t.date} · {cad(t.cashFlow, true)}
            </small>
            <small>{reviewReasons(t).join(' · ')}</small>
          </div>
          <div className="button-row">
            <Button variant="secondary" onClick={() => edit(t)}>
              Review entry
            </Button>
            <Button variant="ghost" onClick={() => skip([...skipped, t.id])}>
              Skip
            </Button>
          </div>
        </div>
      ))}
      {!rows.length && <p>No more uncertain entries in this session.</p>}
      {editing && (
        <Modal title="Quick transaction review" onClose={() => edit(null)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!splitsMatch(editing)) return;
              setSaving(true);
              try {
                const changes = {
                  category: editing.category,
                  classification: editing.classification,
                  merchantOverride: editing.merchantOverride || null,
                  detailCategory: transactionDetail(editing)?.code || null,
                  forecastTreatment: editing.forecastTreatment || 'automatic',
                  splits: editing.splits || [],
                  saveRule: false,
                };
                if (demo)
                  refresh({
                    ...state,
                    transactions: state.transactions.map((t) =>
                      t.id === editing.id
                        ? {
                            ...t,
                            ...changes,
                            merchantCorrected: true,
                            detailCategoryCorrected: true,
                            userCorrected: true,
                          }
                        : t,
                    ),
                  });
                else
                  refresh(
                    await api<AppState>(
                      `/transactions/${encodeURIComponent(editing.id)}`,
                      'PATCH',
                      changes,
                    ),
                  );
                skip([...skipped, editing.id]);
                edit(null);
                notify('Saved. Your forecast will update.');
              } catch (err) {
                notify((err as Error).message, true);
              } finally {
                setSaving(false);
              }
            }}
          >
            <div className="form-stack">
              <Badge>
                {editing.date} · {cad(editing.cashFlow, true)}
              </Badge>
              <p>Bank label: {editing.description}</p>
              <EnrichmentSummary transaction={editing} />
              <Field label="Company name">
                <input
                  value={editing.merchantOverride || ''}
                  placeholder={merchantName(editing)}
                  maxLength={160}
                  onChange={(e) => edit({ ...editing, merchantOverride: e.target.value })}
                />
              </Field>
              <Field label="Category">
                <select
                  aria-label="Review category"
                  value={editing.category}
                  onChange={(e) =>
                    edit({
                      ...editing,
                      category: e.target.value as Transaction['category'],
                      classification: classify(
                        e.target.value as Transaction['category'],
                        editing.cashFlow,
                      ),
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
              <Field label="Detailed category">
                <select
                  value={transactionDetail(editing)?.code || ''}
                  onChange={(e) =>
                    edit({
                      ...editing,
                      detailCategory: e.target.value || null,
                      detailCategoryCorrected: true,
                    })
                  }
                >
                  <option value="">No confirmed detail</option>
                  {detailOptions(editing.category).map((d) => (
                    <option key={d.code} value={d.code}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </Field>
              <TransactionContext transaction={editing} change={edit} />
            </div>
            <div className="modal-actions">
              <Button type="button" variant="ghost" onClick={() => edit(null)}>
                Cancel
              </Button>
              <Button disabled={saving || !splitsMatch(editing)}>Save review</Button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}
