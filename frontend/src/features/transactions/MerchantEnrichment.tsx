import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import type { AppState, Transaction } from '../../../../shared/schema';
import { automaticMerchant } from '../../../../shared/merchants';
import { api, useApp } from '../../lib';
import { Badge, Button } from '../../components/ui';

export function EnrichmentSummary({ transaction: t }: { transaction: Transaction }) {
  const result = automaticMerchant(t);
  if (!result && t.categoryOrigin !== 'enrichment') return null;
  return (
    <section className="enrichment-suggestion">
      <Badge>
        {result?.method === 'groq' ? 'AI estimate applied' : 'Automatic cleanup applied'}
      </Badge>
      <p>
        {result?.name || t.category} is already used in your transaction list and outlook. You can
        correct it below; your edit takes priority.
      </p>
    </section>
  );
}

type CleanupResponse = { state: AppState; status: string; configured: boolean; remaining?: number };
const messages: Record<string, string> = {
  unavailable: 'Cleanup is temporarily paused. Your saved transactions are still available.',
  not_configured: 'Local cleanup is up to date. AI cleanup is unavailable.',
  rate_limited:
    'AI cleanup is waiting for its next available batch. Results so far are already applied.',
  cached: 'Saved cleanup is applied. Your corrections always take priority.',
  suggestions:
    'New names and estimated categories are applied. Edit anything that needs your context.',
  local: 'Local cleanup is applied. Edit a name or category directly in the list.',
};

export function MerchantEnrichment() {
  const { w, demo, save, refresh } = useApp();
  const [busy, setBusy] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [status, setStatus] = useState('');
  const [remaining, setRemaining] = useState(0);
  const [pass, setPass] = useState(0);
  const [saving, setSaving] = useState(false);
  const settings = w.intelligenceSettings || { autoSync: false, alerts: true, dismissed: [] };
  const external = settings.groqEnrichment === true;
  useEffect(() => {
    if (demo) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const run = async () => {
      setBusy(true);
      try {
        const r = await api<CleanupResponse>('/transactions/enrichment', 'POST', {});
        if (!active) return;
        refresh(r.state);
        setConfigured(r.configured);
        setStatus(r.status);
        setRemaining(r.remaining || 0);
        if (
          external &&
          r.configured &&
          r.remaining &&
          ['suggestions', 'rate_limited'].includes(r.status)
        ) {
          timer = setTimeout(() => void run(), r.status === 'rate_limited' ? 60000 : 35000);
        }
      } catch {
        if (active) setStatus('unavailable');
      } finally {
        if (active) setBusy(false);
      }
    };
    void run();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [demo, w.source, external, refresh, pass]);
  return (
    <section className="merchant-enrichment" aria-label="Automatic transaction cleanup">
      <div className="cleanup-heading">
        <Sparkles size={19} aria-hidden="true" />
        <div>
          <strong>
            {busy ? 'Tidying your transactions…' : 'Transaction cleanup is automatic'}
          </strong>
          <p role="status">
            {demo
              ? 'This sample uses local cleanup. Edit any transaction to try a correction.'
              : messages[status] || 'Checking merchant names and categories in the background.'}
          </p>
          {!!remaining && external && (
            <small>{remaining} merchant descriptions still queued.</small>
          )}
        </div>
      </div>
      <details>
        <summary>Cleanup settings</summary>
        <p>
          Names are cleaned as transactions arrive and when you open this view. Clear category
          estimates are applied to uncategorized purchases. Your bank descriptions and amounts stay
          available in Details.
        </p>
        <p>
          Cleanup recognizes Toronto transit, including PRESTO debit charges, and TMU campus
          services. Campus top-ups and other purchases with an unclear purpose stay open for review.
        </p>
        <label className="checkbox-line">
          <input
            type="checkbox"
            checked={external}
            disabled={demo || w.source !== 'live' || !configured || saving}
            onChange={async (e) => {
              const checked = e.target.checked;
              setSaving(true);
              try {
                await save({
                  ...w,
                  intelligenceSettings: { ...settings, groqEnrichment: checked },
                });
              } catch {
                /* App save displays the error. */
              } finally {
                setSaving(false);
              }
            }}
          />
          Use Groq for unfamiliar merchants
        </label>
        <p className="field-note">
          When enabled, Groq receives cleaned merchant descriptions, without amounts, dates,
          balances or account details. AI names and categories are estimates you can edit.{' '}
          <a href="https://console.groq.com/docs/your-data" target="_blank" rel="noreferrer">
            Groq data controls
          </a>
        </p>
        {!configured && !demo && (
          <p className="field-note">
            AI cleanup is not currently available. Local cleanup still works.
          </p>
        )}
        <Button
          variant="secondary"
          disabled={demo || busy}
          onClick={() => setPass((value) => value + 1)}
        >
          Check again
        </Button>
      </details>
    </section>
  );
}
