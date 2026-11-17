import { useState } from 'react';
import { CreditCard, ExternalLink } from 'lucide-react';
import type { CreditCardComparison } from '../../../../shared/intelligence';
import { cad } from '../../../../shared/finance';
import { Badge, Field } from '../../components/ui';

export function CreditCardMatches({ report }: { report: CreditCardComparison }) {
  const [kind, setKind] = useState('all');
  const [fee, setFee] = useState('all');
  const [currentId, setCurrentId] = useState('');
  const current = report.cards.find((card) => card.id === currentId);
  const cards = report.cards.filter(
    (card) => (kind === 'all' || card.kind === kind) && (fee !== 'free' || !card.annualFee),
  );
  const bestNet =
    report.enoughHistory && !report.stale
      ? Math.max(...cards.flatMap((card) => (card.annualNet === null ? [] : [card.annualNet])))
      : null;
  return (
    <section className="intelligence-section card-matches" aria-labelledby="card-matches-title">
      <h3 id="card-matches-title" className="sr-only">
        Credit card matches
      </h3>
      <div className="card card-match-context">
        <CreditCard size={23} />
        <div>
          <strong>
            {report.paidInFull === 'no'
              ? 'Interest can outweigh rewards. Card recommendations are paused.'
              : report.paidInFull === 'unknown'
                ? 'Set your repayment preference in “Try a change” to see rankings.'
                : 'Compared by yearly rewards after fees.'}
          </strong>
          <p>Terms reviewed {report.reviewedAt} · eligibility varies by card</p>
        </div>
      </div>
      <div className="intelligence-control-grid card-match-filters">
        <Field label="Reward preference">
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="all">Cash back & points</option>
            <option>Cash back</option>
            <option>Points</option>
          </select>
        </Field>
        <Field label="Annual fee preference">
          <select value={fee} onChange={(e) => setFee(e.target.value)}>
            <option value="all">Compare fees and rewards</option>
            <option value="free">No annual fee only</option>
          </select>
        </Field>
        <Field label="Compare with a card I have">
          <select value={currentId} onChange={(e) => setCurrentId(e.target.value)}>
            <option value="">Choose a listed card (optional)</option>
            {report.cards.map((card) => (
              <option value={card.id} key={card.id}>
                {card.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="outlook-stat-grid card-comparison-stats">
        <article className="outlook-stat-card">
          <span className="stat-card-label">Eligible spending</span>
          <strong className="stat-card-value">{cad(report.monthlyEligibleSpend)}</strong>
          <small>Per month · {report.observedDays} observed days</small>
        </article>
        <article className="outlook-stat-card">
          <span className="stat-card-label">Highest reward estimate</span>
          <strong className="stat-card-value">
            {bestNet !== null && Number.isFinite(bestNet) ? cad(bestNet) : '—'}
          </strong>
          <small>Per year after fees · before interest</small>
        </article>
        <article className="outlook-stat-card">
          <span className="stat-card-label">No annual fee</span>
          <strong className="stat-card-value">
            {cards.filter((card) => card.annualFee === 0).length} cards
          </strong>
          <small>In this comparison</small>
        </article>
      </div>
      {!cards.length && (
        <p className="inline-notice">
          No cards in this small catalogue match both filters. Try including annual-fee cards or
          cash back.
        </p>
      )}
      <div className="intelligence-cards">
        {cards.map((card) => (
          <article
            className={`card credit-match ${card.id === report.recommendedId ? 'credit-match-best' : ''}`}
            key={card.id}
          >
            <div className="credit-match-heading">
              <Badge>{card.kind}</Badge>
              <span>{card.network}</span>
            </div>
            <h3>{card.name}</h3>
            {card.id === report.recommendedId && (
              <Badge tone="green">Highest estimated net value in this catalogue</Badge>
            )}
            <div className="credit-match-value">
              <strong>
                {card.annualNet === null ? 'More history needed' : cad(card.annualNet)}
              </strong>
              <span>estimated yearly rewards after fee</span>
            </div>
            <dl>
              <div>
                <dt>Annual rewards value</dt>
                <dd>{card.annualRewards === null ? '—' : cad(card.annualRewards)}</dd>
              </div>
              <div>
                <dt>Annual card fee</dt>
                <dd>{cad(card.annualFee)}</dd>
              </div>
              {card.annualPoints !== null && (
                <div>
                  <dt>Estimated yearly points</dt>
                  <dd>{card.annualPoints.toLocaleString('en-CA')}</dd>
                </div>
              )}
              {current &&
                current.id !== card.id &&
                current.annualNet !== null &&
                card.annualNet !== null && (
                  <div>
                    <dt>Difference vs selected card</dt>
                    <dd>{cad(card.annualNet - current.annualNet)}/year</dd>
                  </div>
                )}
            </dl>
            {card.chosenCategories.length > 0 && (
              <p>
                <strong>Suggested bonus categories:</strong> {card.chosenCategories.join(', ')}
              </p>
            )}
            <details>
              <summary>Calculation & eligibility</summary>
              <p>{card.terms}</p>
              <ul>
                {card.benefits.map((benefit) => (
                  <li key={benefit}>{benefit}</li>
                ))}
              </ul>
              <p>{card.eligibility}</p>
              {card.breakdown.map((row) => (
                <div className="intelligence-list-item" key={row.category}>
                  <div>
                    <strong>{row.category}</strong>
                    <p>{cad(row.monthlySpend)}/month of observed spending</p>
                  </div>
                  <span>
                    {report.enoughHistory ? `${cad(row.annualRewards)}/year` : 'Estimate pending'}
                  </span>
                </div>
              ))}
              <p>
                Each card is compared as a replacement for eligible spending. Estimates are not
                additional rewards on top of your current card.
              </p>
              {card.sources.map((url, i) => (
                <a key={url} href={url} target="_blank" rel="noreferrer">
                  Issuer source {i + 1}
                  <ExternalLink size={12} />
                </a>
              ))}
            </details>
            <a className="button secondary" href={card.url} target="_blank" rel="noreferrer">
              Review issuer details <ExternalLink size={15} />
            </a>
          </article>
        ))}
      </div>
      <details
        className="card intelligence-methods card-match-methods"
        open={report.stale || !report.enoughHistory}
      >
        <summary>How card estimates work</summary>
        <p>
          {report.observedDays} observed days · {cad(report.excludedOutflows)} of outflows excluded
          from rewards.
        </p>
        <ul>
          {report.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
        <p>
          No affiliate links or paid placement. Rewards are never added to your cash-flow forecast.
        </p>
      </details>
    </section>
  );
}
