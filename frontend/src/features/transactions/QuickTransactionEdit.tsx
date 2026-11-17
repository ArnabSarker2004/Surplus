import { useState } from 'react';
import {
  categories,
  type AppState,
  type Category,
  type Transaction,
} from '../../../../shared/schema';
import { classify } from '../../../../shared/finance';
import { merchantName, merchantRuleKey } from '../../../../shared/merchants';
import { Button, Field } from '../../components/ui';
import { api, useApp } from '../../lib';
import { depositPurposes, depositPurposePatch } from '../../../../shared/deposits';

export function QuickTransactionEdit({
  transaction: t,
  onClose,
  onDetails,
  focusCategory = false,
  focusDeposit = false,
}: {
  transaction: Transaction;
  onClose: () => void;
  onDetails: () => void;
  focusCategory?: boolean;
  focusDeposit?: boolean;
}) {
  const { state, refresh, demo, notify } = useApp();
  const [name, setName] = useState(merchantName(t));
  const [category, setCategory] = useState(t.category);
  const [purpose, setPurpose] = useState(t.depositPurpose || '');
  const [saveRule, setSaveRule] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const split = !!t.splits?.length;
  return (
    <form
      className="transaction-quick-edit"
      aria-label={`Quick edit ${merchantName(t)}`}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !saving) {
          e.preventDefault();
          onClose();
        }
      }}
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        const nameChanged = name.trim() !== merchantName(t) || (saveRule && !t.merchantOverride);
        const changes = {
          category,
          classification:
            category === t.category ? t.classification : classify(category, t.cashFlow),
          saveRule: purpose ? false : saveRule,
          ...(nameChanged ? { merchantOverride: name.trim() || null } : {}),
          ...(category !== t.category ? { detailCategory: null } : {}),
          ...(purpose
            ? depositPurposePatch(purpose as NonNullable<Transaction['depositPurpose']>, {
                ...t,
                category,
              })
            : {}),
        };
        try {
          if (demo) {
            const key = merchantRuleKey(t);
            refresh({
              ...state,
              transactions: state.transactions.map((row) =>
                row.id === t.id ||
                (saveRule &&
                  key &&
                  row.source === t.source &&
                  !row.userCorrected &&
                  merchantRuleKey(row) === key)
                  ? {
                      ...row,
                      ...changes,
                      userCorrected: row.id === t.id || row.userCorrected,
                      categoryOrigin: 'user',
                      depositPurpose:
                        changes.depositPurpose ??
                        (row.category === category ? row.depositPurpose : undefined),
                      ...(nameChanged ? { merchantCorrected: true } : {}),
                      ...(category !== t.category ? { detailCategoryCorrected: true } : {}),
                    }
                  : row,
              ),
            });
          } else
            refresh(
              await api<AppState>(`/transactions/${encodeURIComponent(t.id)}`, 'PATCH', changes),
            );
          notify(
            saveRule
              ? 'Saved. This merchant’s future transactions will use your choices.'
              : 'Transaction updated.',
          );
          onClose();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setSaving(false);
        }
      }}
    >
      <div className="quick-edit-title">
        <strong>Make a quick correction</strong>
        <span>Original: {t.description}</span>
      </div>
      <fieldset disabled={saving}>
        <div className="quick-edit-fields">
          <Field label="Merchant name">
            <input
              autoFocus={!focusDeposit && (!focusCategory || split)}
              value={name}
              maxLength={160}
              onChange={(e) => setName(e.target.value)}
              placeholder="Use the original bank name"
            />
          </Field>
          <Field label="Category">
            <select
              value={category}
              disabled={split}
              autoFocus={focusCategory && !split}
              onChange={(e) => {
                setCategory(e.target.value as Category);
                setPurpose('');
              }}
            >
              {categories.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </Field>
        </div>
        {t.cashFlow > 0 && !split && (
          <Field
            label="Deposit source"
            hint="Loans, OSAP, grants, scholarships and RESP are deducted from your personal balance."
          >
            <select
              required={focusDeposit}
              autoFocus={focusDeposit}
              value={purpose}
              onChange={(e) => {
                setPurpose(e.target.value);
                setSaveRule(false);
              }}
            >
              <option value="">Use detected source</option>
              {depositPurposes.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        )}
        {split && (
          <p className="field-note">
            This purchase is split. Use Details to change its individual parts.
          </p>
        )}
        <label className="checkbox-line">
          <input
            type="checkbox"
            checked={saveRule}
            disabled={!merchantRuleKey(t) || split || !!purpose}
            onChange={(e) => setSaveRule(e.target.checked)}
          />
          Remember this for the same merchant
        </label>
        <div className="button-row">
          <Button type="submit">{saving ? 'Saving…' : 'Save changes'}</Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" variant="ghost" onClick={onDetails}>
            Details & split purchase
          </Button>
        </div>
      </fieldset>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
