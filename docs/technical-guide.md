# Surplus technical guide

[Back to the project overview](../README.md)

This guide contains setup, API, persistence, calculation, and verification details. Commands run from the repository root unless a different directory is specified.

## Environment reference

Use [`.env.example`](../.env.example) as the server-side configuration template. Preserve existing values when creating or editing `.env`. Never prefix secrets with `VITE_`; those names are intended for browser-visible build configuration.

| Variable(s) | Purpose | Default / requirement |
| --- | --- | --- |
| `PORT` | Express port | `3001`; changing it also requires matching the Vite API proxy |
| `SURPLUS_DATA_DIR` | Local database and generated key directory | Ignored `data/` directory |
| `DATABASE_URL` | Enable PostgreSQL accounts/storage | Omit for the one-owner SQLite mode |
| `DATABASE_CA_FILE` | Trusted database certificate authority file | Optional; Supabase uses the bundled public CA |
| `AUTH_PUBLIC_ORIGIN` | Exact browser origin and provider callback base | Match the address used in the browser; the example uses `http://localhost:5173` |
| `JWT_SIGNING_KEY` | Server session signing key | Optional 64 hex characters; otherwise a persistent key is generated locally |
| `PLAID_CLIENT_ID` | Server-side banking client identifier | Required only for Plaid connections |
| `PLAID_SANDBOX_SECRET` | Sandbox API access | Required only for Sandbox connections |
| `PLAID_PRODUCTION_SECRET` | Production API access | Required only for supported live connections |
| `PLAID_SANDBOX_ACCESS_TOKEN` | Import an existing Sandbox item | Optional; environment-token import is restricted in PostgreSQL mode |
| `TOKEN_ENCRYPTION_KEY` | AES-256-GCM bank-token key | Optional 64 hex characters; otherwise generated as `data/.token-key` |
| `PLAID_PLAN`, `PLAID_TRIAL_CONFIRMED_ON` | Gate optional trial-specific calls | Leave unset unless the documented plan checks apply; confirmation expires after 30 days |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OpenID Connect sign-in | Optional; requires matching provider application/callback configuration |
| `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_TENANT_ID` | Microsoft OpenID Connect sign-in | Optional; example tenant is `common` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Deliver one-time email sign-in codes | Optional; authenticated TLS mail configuration; example port `587` |
| `INTELLIGENCE_SERVICE_URL` | Private Python endpoint | `http://127.0.0.1:8001` |
| `INTELLIGENCE_SERVICE_TOKEN` | Authenticate Express-to-Python requests | Optional override of at least 32 characters; otherwise generated locally |
| `GROQ_API_KEY`, `GROQ_MODEL` | Optional unfamiliar-merchant suggestions | Server/Python only; in-app opt-in is also required; example model `openai/gpt-oss-20b` |
| `ECONOMIC_DATA_OFFLINE` | Disable public CPI requests | Set `1` for offline mode; cache/no-adjustment behavior is documented in the intelligence guide |

Bank/provider configuration is optional for the public demo. Keep generated encryption keys with the database: losing a bank-token key requires reconnecting the item. Copying the example file does not configure real providers or verify connectivity.

## Terminology

| Term | Meaning in Surplus |
| --- | --- |
| Frontend / backend | The browser interface / the server managing accounts, requests, integrations, and storage |
| API / endpoint | The server interface / one URL and HTTP method used to call it |
| Contract / validation | An expected input/output shape / checking data against it before using it |
| Normalization | Converting different bank field conventions into consistent app fields |
| Cursor / pagination | A bookmark for processed updates / retrieving a response across several pages |
| Atomic commit | Saving related changes together so partial progress does not become the saved state |
| Repository | A code boundary that loads and saves domain data |
| Row-level security | Database policies restricting records to the authenticated user |
| Row lock | A database mechanism serializing operations on the same workspace record |
| Baseline / holdout | A simple comparison forecast / later historical observations excluded from training |
| MAE | Mean absolute error: the average size of prediction errors, in the same units as the predicted values |
| Simulation percentile | A position within generated outcomes, not a guaranteed future result |
| CPI | Consumer Price Index, used for explicit price scenarios rather than guaranteed future prices |
| CI / end-to-end test | Automated checks on code changes / a test following a workflow through the browser |

## Run locally

Requires Node.js **20.12 or newer**, npm, and Python **3.12** for financial forecasting.

```sh
npm ci
npm run intelligence:setup
npm run dev
```

Open **http://127.0.0.1:5173** and choose **Try demo** for the account-free fictional workspace, or create your local owner account for a saved plan. Existing saved data is preserved during account setup. Demo Mode needs no bank credentials, AI account, or deployment. The Express API runs at `http://127.0.0.1:3001` and the Python service at `http://127.0.0.1:8001`. Use the same browser address when returning.

For a production frontend build served by the local API:

```sh
npm run build
npm start
```

Then open **http://127.0.0.1:3001**. Stop the development API first; both use port 3001. The API remains bound to localhost; public deployment is a separate setup.

## Connect PostgreSQL / Supabase

Save the PostgreSQL connection URI in the server `.env` as `DATABASE_URL`, then run:

```sh
npm run db:check
npm run db:migrate
npm run dev
```

Use **Create account** on the login page. Each account gets its own saved plan and Plaid connection. Supabase supplies PostgreSQL; authentication remains in this backend. The Supabase Data API can remain disabled. To bring an existing local plan into your account, follow [the guarded import procedure](../docs/database.md#import-your-existing-local-plan).

## Architecture

One repository and dependency lockfile, with explicit frontend, backend, and shared-domain boundaries:

```text
frontend/
  index.html
  public/                         # Locally served assets
  src/
    App.tsx                       # Navigation and app state orchestration
    main.tsx                      # React entry and error boundary
    lib.tsx                       # API client and app context
    components/                   # Reusable UI primitives and domain editors
    features/resources/           # Resource discovery, cards, contacts and tracking
    pages/                        # One file per feature page
    styles.css                    # Original design system and responsive layouts
    accessibility.css             # Readability and contrast refinements
backend/
  src/
    index.ts                      # Environment, database and server bootstrap
    app.ts                        # Composition root
    catalog/                      # Reviewed public TMU resource records
    routes/                       # HTTP validation and response adapters
    services/                     # Transaction corrections and Plaid lifecycle
    repositories/                 # Domain object persistence boundary
    infrastructure/               # PostgreSQL connection/migrations; local SQLite fallback
    integrations/                 # Plaid client, encryption, sync, test fixture
    middleware/                   # Local security and sanitized errors
shared/
  schema.ts                       # Zod contracts and TypeScript domain models
  resources.ts                    # Resource contracts, dates, progress and calendars
  demo.ts                         # Reproducible student persona and sample data
  finance.ts                      # Public domain exports
  finance/                        # Pure, focused calculation modules
    money.ts                      # Dates, recurrence, rounding, CAD formatting
    planning.ts                   # Funding, costs, monthly timeline
    categorization.ts             # Student mappings and classifications
    transactions.ts               # Normalization and analytics
    opportunities.ts              # Explainable matching
    scenarios.ts                  # Hypothetical plan effects
    savings.ts                    # Safe-to-save and trend forecast
    readiness.ts                  # Investing education prerequisites
    investment.ts                 # Compound-growth illustration
    insights.ts                   # Deterministic spending observations
tests/
  finance.test.ts                 # Financial invariants and edge cases
  plaid.test.ts                   # Pagination, corrections, encryption
  api.test.ts                     # Persistence, validation, security, workflows
  resources.test.ts               # Source integrity, freshness, dates and calendars
  e2e/                           # Browser journeys and accessibility checks
  intelligence-browser/          # Browser tests with the real local Python service
  postgres-browser/              # Browser tests for PostgreSQL account workflows
services/intelligence/
  app/contracts.py               # Bounded Python input/output contracts
  app/models.py                  # Baselines, learned models, chronological evaluation
  app/engine.py                  # Scheduled ledger and cash-flow simulations
  app/student.py                 # Work schedules, tuition and semester outlook
  app/main.py                    # Authenticated internal FastAPI endpoints
  tests/                         # Python financial and forecasting tests
backend/migrations/              # Account tables, RLS and intelligence persistence
scripts/                         # Database, auth, Sandbox and service CLI workflows
docs/
  architecture.md
  tmu-resources.md                # Research sources, curation rules and maintenance
  product-brief.md                # Original brief, preserved verbatim
```

React pages call typed HTTP helpers. Routes validate requests with Zod and delegate to services/repositories. Both frontend and backend import the same pure domain functions. The shared domain has no dependency on React, Express, SQLite, or network access.

**Stack:** React, TypeScript, Vite, Express, Zod, PostgreSQL through pg, SQLite through sql.js, Motion, Recharts, Lucide, native HTML form controls and dialogs. Node's built-in test runner, Supertest, Playwright, and axe provide verification. DM Sans and Instrument Serif are served locally through Fontsource under their SIL Open Font Licenses.

Set `DATABASE_URL` to use PostgreSQL with separate accounts, user-owned tables, custom JWT authentication, transaction locks, and row-level security. Omit it for the original single-owner SQLite workspace. Both modes use the same domain services. See [database setup and importing local data](../docs/database.md). Existing local data is preserved when switching modes and is never automatically assigned to a new signup.

## API and service boundaries

Express owns browser authentication, bank credentials, persistence, and request validation. React calls its typed HTTP helpers; pure financial functions in `shared/` are reused by both sides. Python receives a selected financial snapshot through the backend and does not receive Plaid access tokens or perform database authentication.

| Method | Browser-facing path | Responsibility |
| --- | --- | --- |
| GET | `/api/health` | API health response |
| GET / POST | `/api/auth/session`, `/api/auth/register`, `/api/auth/login`, `/api/auth/logout` | Session inspection and account lifecycle; session is GET, other listed actions are POST |
| POST / GET | `/api/auth/oauth/:provider/start`, `/api/auth/oauth/:provider/callback` | Start and finish provider sign-in |
| POST | `/api/auth/email/request`, `/api/auth/email/verify` | One-time email sign-in challenges |
| GET | `/api/resources` | Public curated resource catalog |
| GET / PUT | `/api/state`, `/api/workspace` | Read authenticated state / save validated workspace |
| POST | `/api/demo` | Seed a saved demo workspace, separate from the public in-memory demo |
| PATCH | `/api/transactions/:id` | Correct category, classification, merchant evidence, or review fields |
| GET / POST | `/api/transactions/enrichment` | Inspect / request merchant cleanup |
| GET / POST | `/api/plaid/status`, `/api/plaid/link-token`, `/api/plaid/exchange`, `/api/plaid/sync` | Inspect status with GET; create Link token, exchange token, or synchronize with POST |
| DELETE | `/api/plaid/item` | Revoke and remove a connected item |
| POST | `/api/intelligence/forecast` | Validate options, call Python, and save forecast history |
| PATCH | `/api/intelligence/habits/:id` | Persist a transaction's forecast treatment |
| GET / DELETE | `/api/export`, `/api/data` | Export financial state / delete workspace data |

Private routes require the application session. SQLite and PostgreSQL adapters share the main route surface, with some mode-specific banking operations: importing an existing environment token is restricted in PostgreSQL mode. Route implementations are in [backend/src/routes](../backend/src/routes/); the table is a guide to the main endpoints rather than an exhaustive API specification.

For example, a transaction correction passes Zod validation, updates the active user's repository, optionally saves a merchant rule, and becomes available to both spending calculations and the next Python forecast. A forecast response includes model-selection details and assumptions; it does not move funds or change budget limits.

## Plaid bank connections

1. Copy `.env.example` to `.env` if you do not already have one.
2. Get your client ID and Sandbox secret from the [Plaid developer dashboard](https://dashboard.plaid.com/developers/keys).
3. Set `PLAID_CLIENT_ID` and `PLAID_SANDBOX_SECRET` in `.env`.
4. Optionally set `PLAID_SANDBOX_ACCESS_TOKEN` for an existing Sandbox item.
5. Restart the API, then open **Settings & connections**.

| Variable                     | Purpose                                                      |
| ---------------------------- | ------------------------------------------------------------ |
| `PLAID_CLIENT_ID`            | Server-side Plaid client ID                                  |
| `PLAID_SANDBOX_SECRET`       | Server-side Sandbox secret                                   |
| `PLAID_SANDBOX_ACCESS_TOKEN` | Optional existing Sandbox item                               |
| `TOKEN_ENCRYPTION_KEY`       | Optional 64 hex characters / 32 bytes for AES-256-GCM        |
| `PORT`                       | API port; defaults to 3001 (Vite proxy expects 3001)         |
| `SURPLUS_DATA_DIR`           | Optional database/key directory; defaults to ignored `data/` |

When no encryption key is configured, the server generates `data/.token-key`. Access tokens are encrypted in the active database with AES-256-GCM. Keep the key alongside the database for local restart; losing it requires reconnecting your bank. `.env`, the database, caches, keys, and test artifacts are ignored by Git.

Set `PLAID_PRODUCTION_SECRET` to enable **Connect my bank** during setup and in Settings. The server uses the matching Production or Sandbox endpoint and persists that environment with each encrypted connection. New Link connections request Transactions, Canadian institutions, and up to 730 days of available history. Existing connections retain their initial history window, and bank availability may be shorter. Users authenticate and consent in Plaid or their bank; Surplus does not collect card numbers, CVVs, or banking passwords. See [live banking setup](../docs/live-banking-setup.md). For the dynamic test account, the server uses First Platypus Bank (`ins_109508`), `user_transactions_dynamic`, and `pass_good`. The CAD student fixture uses Plaid's `user_custom` configuration with locally generated sample transactions.

Click **Sync transactions** after connecting. If history is still preparing, sync again later. Connected bank data powers transaction categories, spending summaries, and calculation-based insights without adding bank deposits to planned semester funding. Live, Demo, and Sandbox data stay separate. The Money outlook page additionally fits and validates per-workspace Python models on request; see [financial intelligence](../docs/financial-intelligence.md). The dynamic institution may return USD accounts; those appear with their currency and are excluded from CAD totals. No exchange rate is invented.

All sync pages are staged before committing data and cursor together. A pagination mutation retries from the original cursor, up to three attempts. Merchant corrections survive modified transactions and pending-to-posted replacement. Failed sync retains previous data. Manual sync is available, with optional six-hour polling for opted-in live workspaces while the backend is running. Public webhooks are not implemented.

Sources: [Plaid Transactions](https://plaid.com/docs/transactions/), [sync API](https://plaid.com/docs/api/products/transactions/), [custom Sandbox data](https://plaid.com/docs/sandbox/user-custom/).

## Calculation rules

Money is rounded to cents. Recurrence uses actual scheduled dates inside the semester, with monthly dates clamped to the last valid day of shorter months.

```text
planned funding = confirmed/received sources
                + expected employment
                + awarded opportunities paid inside the semester
ending balance  = planned funding - planned semester costs
funding gap     = max(0, -ending balance)
target gap      = max(0, desired minimum balance - ending balance)
monthly action  = target gap / remaining monthly planning periods
```

Pending grants, bursaries, and applications do not count as confirmed. Expected employment is included in projections and labelled separately. Repayable funding remains distinct from grants. An opportunity already Awarded is never added again by a scenario.

Bank analytics normalize Plaid's positive expense amounts to negative cash flow. Pending and non-CAD transactions are excluded from CAD totals. Transfers, investment contributions, and credit-card payments are excluded from income/spending; refunds reduce their spending category. Loan proceeds count as cash inflow, **not income earned**. The UI labels their inclusion.

Category priority: explicit user correction → same-source merchant rule → known student merchant → high-confidence Plaid category → Other / Review. Raw amounts and Plaid categories remain intact. Review uncertain deposits, reimbursements, and cash withdrawals manually.

```text
safe to save = max(0,
  spendable chequing cash + confirmed/expected earned income in 30 days
  - planned payments in 30 days - outstanding card balances
  - desired minimum balance - unresolved semester gap)
```

This deliberately conservative estimate reserves upcoming bills as well as the semester gap. Emergency savings and investments are not treated as available spending cash. Manually entered goal balances do not automatically move money or reconcile accounts.

The trend illustration uses the previous three complete months of net cash flow, excluding irregular school funding, multiplied by remaining monthly periods. New tuition bills can make that trend misleading, so it is displayed with that limitation. The entered semester budget remains the primary forecast.

Scenario changes apply to the current and remaining semester months. One-time amounts apply to the current month; opportunities use their sample payment date. Moving funds to a goal reduces available semester cash without creating income or spending. Scenarios are saved separately and never silently change the base plan.

In **Demo examples**, opportunity scores combine hard eligibility checks, time availability, program, skills, interests, and selected types. A conflict caps the score; reasons and missing information are visible. These fictional examples demonstrate financial scenarios. The real TMU resource directory instead shows published requirements, limited profile checks, source dates and provider contacts; it does not claim admission probabilities or automatically count potential payments as income.

Investing readiness checks semester coverage, high-interest debt, emergency savings, income stability, time horizon, and comfort with losses. Surplus may prioritize keeping money liquid over investing. The calculator assumes a constant annual return less fees with month-end contributions; it ignores tax, inflation, and market variability. Negative returns are supported. No individual security or portfolio is recommended.

TFSA contribution room must be entered manually. The app links to [CRA withdrawal and recontribution guidance](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/tax-free-savings-account/withdraw.html); it does not calculate official room or determine eligibility.

## Checks

```sh
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

`npm run check` runs type checking, lint, unit/API tests, and the production build. Browser tests use a separate local API on port 3002 and an isolated database in `data/e2e`. The standard browser suite explicitly disables PostgreSQL. They do not need Plaid credentials and do not overwrite your workspace. Screenshots and failure traces are saved locally under ignored `artifacts/` and `test-results/`.

Additional verification and developer commands:

| Command | Purpose / requirement |
| --- | --- |
| `npm run test:intelligence` | Python financial/forecasting tests; requires the local Python environment |
| `npm run test:e2e:intelligence` | Browser flows against an isolated real Python service |
| `npm run test:postgres` | Database integration tests; see [database setup](../docs/database.md) for the dedicated test configuration |
| `npm run test:e2e:postgres` | Browser account workflows against PostgreSQL |
| `npm run db:check` / `npm run db:migrate` | Inspect database connectivity / apply schema migrations |
| `npm run db:import-local` | Explicit, guarded import of an existing local workspace |
| `npm run auth:check` | Check provider configuration and callback addresses without printing secrets |
| `npm run plaid:check-banks` | Inspect Canadian institution coverage with configured Plaid access |

**Documentation audit, November 16, 2026:** `npm test` passed **158 tests with no failures or skips**, and `npm run test:intelligence` passed **90 Python tests** with two dependency deprecation warnings. These exercise local calculations, HTTP behavior, authentication, integration adapters, controlled bank/service responses, and forecasting rules. This result does not establish a successful real bank connection or deployed service. Browser suites, PostgreSQL suites, builds, lint/type checks, and external integrations were not run in this documentation audit.

Use `npm run format` for consistent source formatting.

With Sandbox credentials configured, `npm run verify:plaid` tests the existing Sandbox item in an isolated in-memory repository, creates and tests a separate CAD student fixture, and removes only that newly created fixture from Plaid afterward. It never changes your saved workspace or logs credentials.

## Security and limitations

- SQLite supports local single-owner use; PostgreSQL supports isolated user workspaces. JWT authentication uses revocable sessions. The API binds to loopback and checks Host, Origin, Fetch Metadata and mutation content type. Google and Microsoft sign-in require app-level provider credentials. See [authentication boundaries](../docs/authentication.md).
- Configured Plaid connections import account and transaction data. The optional Python service performs private local forecasting. The app does not trade, transfer money or guarantee financial outcomes.
- Sample tuition and opportunity amounts are not official TMU fees or listings. Verify real amounts, deadlines, and eligibility independently.
- Monthly projections can miss an earlier intra-month cash shortfall. Future expenses and income must be entered accurately.
- Manual classification is important: merchant descriptions and institution categories can be incomplete or wrong.
- Use the in-app bank removal flow to revoke a connected Plaid item. Manually deleting database files does not revoke bank access or remove credentials from `.env`.
- University names and initials identify institutions. Official artwork has not been bundled; the MVP uses accessible text identification.
- No performance, adoption, forecast accuracy, or savings-improvement claims are made.

Further work includes multi-currency forecasting, durable background synchronization beyond the running local process, and a deployment privacy/security review. The optional six-hour polling loop is already implemented; it is not a hosted scheduler or public webhook service.

## Python forecasting service

Install with `npm run intelligence:setup` (Python 3.12), then run `npm run dev` to start all three services. Open **Money outlook** to build cash-flow ranges, tuition readiness, savings-goal timelines, recurring-bill detection, unusual-purchase reviews, and what-if projections from your current transaction history. No external AI account or paid API is needed. For an app already running, start the Python service with `npm run intelligence:dev`.

Learned models compete against a baseline using future holdout weeks. Sparse histories stay on the baseline. Ranges and deadline readiness describe simulations, not guaranteed outcomes. See the [architecture, methodology, privacy, assumptions, and testing guide](../docs/financial-intelligence.md).

Overview now links directly to **Money outlook**. The public demo includes a clearly labeled Python-generated sample report. Spending-based [Canadian card comparisons](../docs/credit-card-comparisons.md) show estimated rewards after fees, category breakdowns, payment assumptions and official issuer links.

Forecasts load automatically into focused cash, goal, habit, card and model views. [Behavioral intelligence](../docs/behavioral-intelligence.md) adds validated weekday purchase-frequency models, bank-supplied purchase-time/city patterns, payday comparisons, rising recurring charges, monthly Statistics Canada CPI, dynamic goal-date comparisons, 7/14-day liquidity simulations and a one-time savings preview. Routine/planned purchase corrections persist. Scenarios and forecasts do not change saved budget limits or move money. PostgreSQL users should run `npm run db:migrate` for the isolated forecast-history table.

[Transaction enrichment](../docs/transaction-enrichment.md) identifies merchants separately from payment processors, retains match evidence, and supports company corrections and detailed category dropdowns. Those corrections flow into private Python analysis and survive bank sync. Open a transaction's pencil icon to review the evidence and forecast inputs. This uses existing Plaid Transactions fields; no additional enrichment subscription is configured.

Automatic [merchant cleanup](../docs/groq-merchant-enrichment.md) applies resolved names and category estimates to uncategorized purchases on import and when the transaction view opens. Select a name or category for a quick inline correction, and optionally remember it for that merchant. For unfamiliar merchants, set `GROQ_API_KEY` in the server `.env`, restart the API and Python service, then enable **Transactions → Cleanup settings → Use Groq for unfamiliar merchants** in a live workspace. Local cleanup works without a key; live Groq calls require your own account and available quota. Bank amounts and original descriptions are preserved.
