# Repository audit and implementation decisions

At the start of implementation, the repository contained only README.md (the supplied product brief). There was no package manifest, app, backend, database, test suite, dependency, environment configuration, or existing functional UI. No baseline build or test command existed. The original user-edited brief is preserved verbatim in product-brief.md.

## Architecture

- React + TypeScript + Vite, locally hosted fonts, original CSS design system, Lucide icons, Motion, Recharts.
- Express API bound to loopback. Zod validates mutations. Same-origin checks protect writes; local-only Host validation protects against DNS rebinding.
- With `DATABASE_URL`, PostgreSQL stores accounts, sessions and per-user financial records. The backend sets a transaction-local verified user ID under the restricted `surplus_runtime` role; forced row-level security isolates workspaces. A per-user row lock serializes changes. See [database architecture and migration](database.md).
- Without `DATABASE_URL`, SQLite via sql.js avoids native compiler prerequisites on Windows. SQLite document rows contain validated domain objects; transactions, merchant rules, Plaid items and workspace state are persisted. Writes export through an atomic file replacement. SQLite mode remains a single-process, one-owner local option.
- Shared pure calculation functions drive both Demo and Sandbox data. Money is rounded to cents. Pending transactions and non-CAD transactions are excluded from CAD analytics; transfers and card payments are not spending. Semester plans use entered funding and expenses, not duplicated imported deposits.
- Plaid access tokens are encrypted server-side with AES-256-GCM. Sync stages all pages before atomically committing data and cursor; retries start from the original cursor.

## File-level plan

`frontend/src/pages/` holds feature screens; `frontend/src/components/` holds reusable UI and editors. `backend/src/app.ts` composes the API, with HTTP routes, application services, a workspace repository, SQLite infrastructure, security middleware, and a Plaid integration adapter in separate directories. `shared/schema.ts` defines contracts; `shared/finance/` contains focused pure modules for planning, categorization, transactions, matching, savings, scenarios, and education. `shared/demo.ts` contains sample fixtures. `tests/` covers calculations, HTTP workflows, sync, browser journeys, and automated accessibility checks. See the root README for the full directory map.

## Domain models and routes

StudentProfile, Semester, FundingSource, PlannedExpense, Account, Transaction, MerchantRule, Budget, SavingsGoal, PlaidItem, Opportunity, OpportunityApplication, FinancialScenario. Insights and matches are derived from current data.

GET /api/state; PUT /api/workspace; POST /api/demo; DELETE /api/data; PATCH /api/transactions/:id; GET /api/export; GET /api/plaid/status; POST /api/plaid/link-token; POST /api/plaid/exchange; POST /api/plaid/sandbox; POST /api/plaid/student; POST /api/plaid/import; POST /api/plaid/sync; DELETE /api/plaid/item.

## Priorities and boundaries

Working welcome/onboarding → persisted demo → shared finance → semester dashboard → transactions/budgets → opportunities/scenarios → goals/education → optional Plaid → tests and browser checks. Use restrained motion and reduced-motion alternatives. Avoid extra UI libraries where native semantic controls suffice.

Public deployment, automated payments, automated university-site monitoring, and trade execution are postponed. Custom account authentication protects each workspace with JWTs, revocable server sessions and logout. Google/Microsoft OpenID and SMTP email codes are optional adapters; linking requires an existing recent session and never merges accounts by email. See [authentication and provider configuration](authentication.md). The resource hub includes a sourced editorial catalog of real TMU resources with independent tracking; see [the resource architecture and research notes](tmu-resources.md). Financial demo opportunities are labelled fictional. Official institution artwork uses accessible initials/text fallbacks. Live Canadian Plaid connections use per-user encrypted tokens with separate Sandbox and live sources. Update mode repairs existing connections; disconnect revokes live access before clearing imports. See [live banking](live-banking-setup.md). Bank credentials are optional; unavailable Plaid access cannot block Demo Mode.

## Python financial intelligence

A separate, loopback-only FastAPI service learns from each authenticated workspace, with chronological model validation, cash-flow simulations, tuition readiness, goal allocation, recurring-pattern detection, and grounded explanations. Express owns authentication and database access. Python receives a minimal financial snapshot and retains no models or personal data. See [financial intelligence](financial-intelligence.md) for model methods, assumptions, limitations, and tests.
