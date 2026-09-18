# Surplus

**Your semester, with room to grow.**

Surplus is a locally runnable student financial planning app, initially designed around Toronto Metropolitan University. It connects semester funding, everyday spending, savings goals, and student opportunities in one explainable plan.

The idea comes from discovering paid campus projects and Learning Zone stipends by chance while looking for ways to cover school costs. Surplus makes that connection visible: understand the gap, find a possible next step, and see how it could affect the semester.

## Run locally

Requires Node.js **20.12 or newer**, npm, and Python **3.12** for financial forecasting.

```sh
npm ci
npm run intelligence:setup
npm run dev
```

Open **http://127.0.0.1:5173**, create your local owner account, and choose **Try the TMU demo**. Existing saved data is preserved during account setup. Demo Mode needs no bank credentials, AI service, or deployment. The Express API runs at `http://127.0.0.1:3001`. Use the same browser address when returning.

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

Use **Create account** on the login page. Each account gets its own saved plan and Plaid connection. Supabase supplies PostgreSQL; authentication remains in this backend. The Supabase Data API can remain disabled. To bring an existing local plan into your account, follow [the guarded import procedure](docs/database.md#import-your-existing-local-plan).

## What works

- A public landing page introduces Surplus with **Log in**, **Sign up**, and **Try demo** entry points. The account-free demo opens a complete fictional student workspace with editable budgets, transactions, goals, and scenarios. It runs in memory, makes no private workspace API calls, and resets on reload. Open `/#home` to view the landing page while signed in.
- A polished, responsive login with JWT sessions, local passwords, configurable Google/Microsoft sign-in and one-time email codes. Connect additional methods in Settings. Visible **Log out** controls revoke the session, clear private views across tabs, and preserve saved plans. See [Google/Microsoft activation](docs/social-login-setup.md) and [authentication](docs/authentication.md).
- Original warm, responsive interface with local fonts, keyboard controls, reduced-motion support, and a mobile navigation drawer.
- Nine-step onboarding, or a six-step quick path: dropdown presets, editable amounts, an optional dedicated Plaid bank-connection step, and review. Drafts persist in the browser; completed plans persist in PostgreSQL when configured, or local SQLite otherwise.
- Semester costs, confirmed funding, expected employment, grants versus loans, pending applications, funding gaps, and monthly cash flow.
- Demo with nine months of deterministic CAD transactions and no bank credentials required. A fixed **September 16, 2026** snapshot keeps the sample story reproducible.
- Transaction search, month/category/account/type filters, pagination, manual category/classification corrections, and merchant rules.
- Editable monthly budgets, explainable restaurant/coffee/subscription insights, recurring merchant detection, unusual purchase flags, weekly discretionary totals, and transparent spending trends.
- A researched TMU resource hub covering 31 resources: all 10 on-campus Zones, paid placements, campus job routes, awards, events, mentoring, and learning initiatives. Search and filter, open official application routes, draft contact emails, save notes and follow-up dates, and download known dates to your calendar.
- Source-review dates, clear waitlist/closed labels, and separate fixed stipends, hourly wages, variable funding and nonfinancial support. This is a researched snapshot; automatic website monitoring and scheduled notifications are not enabled. See [resource research and maintenance](docs/tmu-resources.md).
- Clearly labelled fictional opportunity listings remain under **Demo examples**, with matching reasons, application status, scenarios, and award-to-funding demonstrations.
- Saved what-if scenarios for spending reductions, extra income, future costs, opportunities, and goal allocations.
- Savings goals, a conservative safe-to-save calculation, emergency coverage, and an explained investing-readiness assessment.
- Investing education, a hypothetical compound-growth calculator, fee effects, and manually entered TFSA contribution room.
- Canadian Production Plaid Link during setup and in Settings, plus Sandbox Link, existing-token import, dynamic test account creation, CAD student fixture creation, cursor-based transaction sync, deduplication, modifications, and removals.
- Local JSON export and deletion controls. Secrets never appear in API responses or frontend code.

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
docs/
  architecture.md
  tmu-resources.md                # Research sources, curation rules and maintenance
  product-brief.md                # Original brief, preserved verbatim
```

React pages call typed HTTP helpers. Routes validate requests with Zod and delegate to services/repositories. Both frontend and backend import the same pure domain functions. The shared domain has no dependency on React, Express, SQLite, or network access.

**Stack:** React, TypeScript, Vite, Express, Zod, PostgreSQL through pg, SQLite through sql.js, Motion, Recharts, Lucide, native HTML form controls and dialogs. Node's built-in test runner, Supertest, Playwright, and axe provide verification. DM Sans and Instrument Serif are served locally through Fontsource under their SIL Open Font Licenses.

Set `DATABASE_URL` to use PostgreSQL with separate accounts, user-owned tables, custom JWT authentication, transaction locks, and row-level security. Omit it for the original single-owner SQLite workspace. Both modes use the same domain services. See [database setup and importing local data](docs/database.md). Existing local data is preserved when switching modes and is never automatically assigned to a new signup.

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

Set `PLAID_PRODUCTION_SECRET` to enable **Connect my bank** during setup and in Settings. The server uses the matching Production or Sandbox endpoint and persists that environment with each encrypted connection. Link requests Transactions, Canadian institutions, and up to 365 days of available history. Users authenticate and consent in Plaid or their bank; Surplus does not collect card numbers, CVVs, or banking passwords. See [live banking setup](docs/live-banking-setup.md). For the dynamic test account, the server uses First Platypus Bank (`ins_109508`), `user_transactions_dynamic`, and `pass_good`. The CAD student fixture uses Plaid's `user_custom` configuration with locally generated sample transactions.

Click **Sync transactions** after connecting. If history is still preparing, sync again later. Connected bank data powers transaction categories, spending summaries, and calculation-based insights without adding bank deposits to planned semester funding. Live, Demo, and Sandbox data stay separate. The Forecasts & AI page additionally fits and validates per-workspace Python models on request; see [financial intelligence](docs/financial-intelligence.md). The dynamic institution may return USD accounts; those appear with their currency and are excluded from CAD totals. No exchange rate is invented.

All sync pages are staged before committing data and cursor together. A pagination mutation retries from the original cursor, up to three attempts. Merchant corrections survive modified transactions and pending-to-posted replacement. Failed sync retains previous data. This local MVP uses manual sync rather than public webhooks.

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

Use `npm run format` for consistent source formatting.

With Sandbox credentials configured, `npm run verify:plaid` tests the existing Sandbox item in an isolated in-memory repository, creates and tests a separate CAD student fixture, and removes only that newly created fixture from Plaid afterward. It never changes your saved workspace or logs credentials.

## Security and limitations

- SQLite supports local single-owner use; PostgreSQL supports isolated user workspaces. JWT authentication uses revocable sessions. The API binds to loopback and checks Host, Origin, Fetch Metadata and mutation content type. Google and Microsoft sign-in require app-level provider credentials. See [authentication boundaries](docs/authentication.md).
- Configured Plaid connections import account and transaction data. The optional Python service performs private local forecasting. The app does not trade, transfer money or guarantee financial outcomes.
- Sample tuition and opportunity amounts are not official TMU fees or listings. Verify real amounts, deadlines, and eligibility independently.
- Monthly projections can miss an earlier intra-month cash shortfall. Future expenses and income must be entered accurately.
- Manual classification is important: merchant descriptions and institution categories can be incomplete or wrong.
- Use the in-app bank removal flow to revoke a connected Plaid item. Manually deleting database files does not revoke bank access or remove credentials from `.env`.
- University names and initials identify institutions. Official artwork has not been bundled; the MVP uses accessible text identification.
- No performance, adoption, forecast accuracy, or savings-improvement claims are made.

Further work includes multi-currency forecasting, background bank synchronization, and a deployment privacy/security review.

## Python forecasting service

Install with `npm run intelligence:setup` (Python 3.12), then run `npm run dev` to start all three services. Open **Forecasts & AI** to build cash-flow ranges, tuition readiness, savings-goal timelines, recurring-bill detection, unusual-purchase reviews, and what-if projections from your current transaction history. No external AI account or paid API is needed. For an app already running, start the Python service with `npm run intelligence:dev`.

Learned models compete against a baseline using future holdout weeks. Sparse histories stay on the baseline. Ranges and deadline readiness describe simulations, not guaranteed outcomes. See the [architecture, methodology, privacy, assumptions, and testing guide](docs/financial-intelligence.md).

Overview now links directly to **Forecasts & AI**. The public demo includes a clearly labeled Python-generated sample report. Spending-based [Canadian card comparisons](docs/credit-card-comparisons.md) show estimated rewards after fees, category breakdowns, payment assumptions and official issuer links.
