# Plaid features and public planning data

Reviewed September 20, 2026. The app does not subscribe users to new paid products.

## What the app uses

| Source | Integration | Cost/coverage boundary |
| --- | --- | --- |
| Existing Plaid Transactions | Cursor sync, corrections/removals, pending status, refunds, merchants/counterparties, category confidence, purchase timestamps and city/region when supplied | Uses the already connected Item and existing Transactions product. Metadata varies by bank. No extra enrichment subscription. |
| Plaid Accounts | Account type, CAD balance, available balance and known/unknown balance status via `/accounts/get` | Endpoint is generally free; balances can be cached. No guarantee of real-time freshness. |
| Optional Trial Balance/Refresh | `/accounts/balance/get` and `/transactions/refresh`, manual buttons with a ten-minute cooldown | Disabled by default. Require server `PLAID_PLAN=trial` and `PLAID_TRIAL_CONFIRMED_ON=YYYY-MM-DD`; confirmation expires after 30 days. Only enable after checking the dashboard. These calls can be billed on paid plans. Refresh is asynchronous. |
| Statistics Canada CPI | Existing public monthly category series, Ontario/Canada; 24-hour public cache | No key or financial data sent. Published monthly, not a real-time price feed. Future inflation is a scenario, not an economic forecast. |
| TMU undergraduate calendar | Seven reviewed 2026–27 tuition, study-period and exam dates in `shared/student-calendar.ts` | Free public reference, maintained as a reviewed snapshot. User must confirm assessed tuition and changes in income/spending. Fall study week excludes Engineering; Chang School rules differ. |

Official references: [Plaid billing](https://plaid.com/docs/account/billing/), [Trial plan](https://support.plaid.com/hc/en-us/articles/39994173227159-What-is-the-Plaid-Trial-plan), [Transactions fields](https://plaid.com/docs/api/products/transactions/), [Statistics Canada CPI table](https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1810000401), [TMU 2026–27 dates](https://www.torontomu.ca/calendar/2026-2027/dates/).

Plaid Trial includes a limited number of lifetime production Items; removing an Item does not restore its allowance. Other bundled products such as Identity, Auth, Assets or Investments are not necessary for a debit-spending forecast and are not activated. Recurring Transactions and Enrich are separate products; this app derives recurring patterns locally and uses the merchant metadata already supplied.

## Automatic updates and alerts

Users can opt in under **Money outlook → This week → Reminders & bank updates**. The backend checks once a minute and syncs eligible live workspaces no more often than every six hours, with backoff after failures. It never automatically calls Balance or Transactions Refresh. After sync it rebuilds the baseline forecast, releasing database locks while Python runs. In-app reminders can be disabled, dismissed, and restored. No email, SMS or push service is enabled.

This works only while the backend is running. A deployed version should use [verified Plaid webhooks](https://plaid.com/docs/transactions/webhooks/) and a durable worker; localhost has no public webhook endpoint. The present worker processes at most 100 opted-in workspaces and is intended for this local side project.

## Forecast records and review

`003_intelligence_journal.sql` adds an isolated, forced-RLS journal. It retains at most 800 same-date bank observations and 540 issued forecast checkpoints per user, including only dates, source, account-set hashes, usable cash, and forecast ranges. Same-day observation updates are allowed; the first eligible forecast for each date cannot be revised. Forecasts require a same-day synced observation and the default inflation mode. Missing observation dates and changed account coverage are not scored. These are cached bank snapshots, not verified daily closing balances.

**About these estimates** reports 7/30/90-day absolute error and range coverage once actual future observations exist. Overlapping samples and a small number of matches do not establish calibrated probabilities. Disconnect and clear-data remove the journal. Goal history also stores bounded aggregate input differences; these explain what changed, not an isolated causal contribution in days.

The review queue and transaction editor preserve bank amounts. Split allocations must sum exactly to the bank amount. A split receipt remains one event for frequency analysis. One-off spending remains in actual history/cash but is excluded from future recurring and variable baselines. Received reimbursements must be positive deposits assigned to their original spending category; no unreceived reimbursement is invented as future income.

The forecast's review prompt counts only posted, nonzero CAD entries within its 730-day history that need a category decision or whose split totals no longer match. Low merchant confidence alone does not prompt. A user-confirmed category (including Other), a remembered rule, or explicit one-off treatment clears the category decision; broken splits still need fixing. The queue sorts by amount, then date. Express forwards this decision as `reviewRequired` so Python warnings and actions agree with the UI. Unknown withdrawals still count as spending, and unknown deposits are still excluded from projected earnings.

Semester work changes apply daily portions of user-entered weekly income/expense changes over inclusive dates. Fourteen-day per-account estimates use assigned bills/pay, observed variable outflows and pending reserves. Unassigned obligations, future transfers, variable income and dated life changes are not allocated across accounts; the UI identifies this partial coverage.

## Further free resources researched

[Bank of Canada Valet](https://www.bankofcanada.ca/valet/docs) offers public exchange-rate and interest-rate series without an API key. It is not connected in this release: applying policy rates to a student's savings would require their actual account rate, and this forecast deliberately excludes non-CAD transactions. It is a useful future source for explicitly modeled currency or interest scenarios.

Public CPI retrieval happens in Express and the forecasting models remain local. The separately opt-in [Groq merchant suggestion pipeline](groq-merchant-enrichment.md) can send cleaned unresolved descriptors to Groq; it sends no separate amounts, dates, balances, account IDs or profile fields. No external geocoding is used.
