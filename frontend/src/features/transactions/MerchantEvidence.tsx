import type { Transaction } from '../../../../shared/schema';
import { merchantDetails, automaticMerchant } from '../../../../shared/merchants';

export function MerchantEvidence({ transaction: t }: { transaction: Transaction }) {
  const m = merchantDetails(t);
  const automatic = automaticMerchant(t);
  return (
    <details className="merchant-evidence">
      <summary>View the evidence behind this match</summary>
      <p>{m.reason}</p>
      {automatic && (
        <p>
          Displayed as {automatic.name} using{' '}
          {automatic.method === 'groq' ? 'an AI estimate' : 'a recognized merchant naming rule'}.
          The provider’s original label is preserved below.
        </p>
      )}
      {t.categoryOrigin === 'enrichment' && (
        <p>The category is an automatic estimate, not a confirmed receipt breakdown.</p>
      )}
      {t.enrichment && (
        <p>
          Descriptor cleanup: {t.enrichment.cleaned}.{' '}
          {t.enrichment.method === 'groq'
            ? `Suggested by ${t.enrichment.model}; not verified.`
            : 'Local rules; no company verification.'}
        </p>
      )}
      <dl>
        <div>
          <dt>Original bank description</dt>
          <dd>{t.description}</dd>
        </div>
        <div>
          <dt>Provider merchant label</dt>
          <dd>{t.merchant}</dd>
        </div>
        <div>
          <dt>Company-match confidence</dt>
          <dd>
            {m.confidence === 'UNKNOWN'
              ? 'Not supplied'
              : m.confidence.replace('_', ' ').toLowerCase()}
          </dd>
        </div>
        <div>
          <dt>Category confidence</dt>
          <dd>
            {t.confidence === 'UNKNOWN'
              ? 'Not supplied'
              : t.confidence.replace('_', ' ').toLowerCase()}{' '}
            · Separate from company confidence
          </dd>
        </div>
        <div>
          <dt>Original category</dt>
          <dd>{t.plaidDetailed || 'Not supplied'}</dd>
        </div>
        {m.mcc && (
          <div>
            <dt>Merchant category code</dt>
            <dd>{m.mcc} · Provider-supplied</dd>
          </div>
        )}
        <div>
          <dt>Place</dt>
          <dd>
            {[t.location?.city, t.location?.region, t.location?.country]
              .filter(Boolean)
              .join(', ') || 'Not supplied'}
            {t.paymentChannel ? ` · ${t.paymentChannel}` : ''}
          </dd>
        </div>
        {t.authorizedAt && (
          <div>
            <dt>Purchase authorization</dt>
            <dd>
              {new Date(t.authorizedAt).toLocaleString('en-CA', { timeZone: 'America/Toronto' })} ·
              Toronto time
            </dd>
          </div>
        )}
      </dl>
      {m.intermediaries.length > 0 && (
        <div className="merchant-intermediaries">
          <strong>Other parties in this payment</strong>
          {m.intermediaries.map((p, i) => (
            <p key={`${p.name}-${i}`}>
              {p.name} · {p.type.replaceAll('_', ' ')}
            </p>
          ))}
          <small>A processor or marketplace is not necessarily the seller.</small>
        </div>
      )}
      {m.website && (
        <p>
          <a href={m.website} target="_blank" rel="noreferrer">
            Website for the provider-identified merchant ↗
          </a>
        </p>
      )}
      <p className="field-note">
        A merchant name does not reveal the exact receipt items or legal parent company. Grocery
        versus non-grocery items at a mixed retailer still need your context.
      </p>
    </details>
  );
}
