# Financial intelligence service

Surplus keeps its Express authentication, database, and Plaid integration. A separate Python service performs local forecasting. **Money outlook** opens on **My semester**: tuition coverage, cash at term end, scheduled job pay, and the next gap without wages. A monthly income-and-cost chart and a work timeline explain the numbers. The main view has no collapsed sections. **Work & study**, **Cash flow**, **My goals**, **Spending habits**, **Card options**, and **This week** provide focused views. Forecast adjustments open from **Try a change** in a dialog.

## Co-op and campus-job schedules

In **Work & study ? Add work term**, enter a job type, work dates, take-home pay, frequency, and first and last paydays. The last payday can follow the final workday. Records share the existing semester funding list, so pay is saved once and remains editable in the semester plan. Adding a work term confirms that the saved jobs describe expected employment income; include all ongoing jobs. Overlapping jobs add together. Removing the last job leaves a confirmed schedule with no job pay. Students with no jobs can explicitly select **I have no job income planned**.

Saved expected/confirmed earned funding replaces both detected recurring wages and learned variable earnings throughout the forecast, including after all jobs end or before a future job begins. An ended received job with an end date also prevents old pay from returning. Pay runs on the entered cadence through the last payday. Applied jobs do not count; received funding is already in the current balance. Grants, loans, and explicit dated changes are separate. Legacy workspaces with no job schedule still estimate wages from transaction history. A job without a last payday continues through the horizon; the UI flags the missing date.

The student report uses the same daily cash paths as the rest of the forecast. Gaps cover days outside saved pay periods; ordinary intervals between recurring paydays are not gaps. The bridge amount is projected spending minus other projected income during the gap, floored at zero. It is a cash need, not an additional bill. Term-end cash is unavailable when the date lies outside the forecast or the starting balance is unknown. Monthly bars include partial first/last months. Tuition coverage protects entered reserves and existing goal savings.

**Cash flow** uses visible buttons for the balance chart, near-term bills, account projections and prices. **About these estimates** holds data assumptions, accuracy information, and transaction cleanup settings. Saved changes rebuild the open report. Public account-free demo forecasts remain a fixed, clearly labeled Python-generated sample; sign in to model personal work terms.

## Running it

Python 3.12 and Node 20+ are required. Install once with `npm run intelligence:setup`; this creates an isolated virtual environment and installs `services/intelligence/requirements.lock`. Then `npm run dev` starts the API, frontend, and Python service. To add the service to an already-running app, use `npm run intelligence:dev` in another terminal.

The Python service listens on loopback port 8001. Optional server-only settings:

```dotenv
INTELLIGENCE_SERVICE_URL=http://127.0.0.1:8001
# Optional: at least 32 characters. Otherwise data/.intelligence-key is generated locally.
INTELLIGENCE_SERVICE_TOKEN=
```

No external AI account, paid API or hosted model is required. Run `npm run db:migrate` for PostgreSQL installations: migration `002_forecast_history.sql` adds isolated goal-date comparisons. Production hosting and background jobs are separate deployment work. `npm start` starts the Express app; the Python service must run alongside it. Public CPI requests can be disabled with `ECONOMIC_DATA_OFFLINE=1`; cached data is used when available, otherwise the forecast clearly reports that no CPI adjustment was applied.

## Architecture and data handling

- `services/intelligence/app/contracts.py`: strict, bounded financial input contracts.
- `models.py`: lag-feature regression, rolling chronological validation, baseline comparison.
- `patterns.py`: cadence detection and robust category-relative purchase review.
- `behavior.py`: validated purchase-frequency models, timestamp sequences, coarse locations, matched payday comparisons and merchant charge trends.
- `habits.py`: weekday spending, routine/optional corrections and intervention scenarios.
- `economy.py`: category CPI normalization and explicit future price scenarios.
- `goals.py`: competing goal allocations and dynamic timelines.
- `liquidity.py`: short-term cash pressure and a conservative one-time savings preview.
- `engine.py`: financial ledger, uncertainty simulation, tuition and goal allocation.
- `assistant.py`: grounded explanations generated from calculated results.
- `main.py`: FastAPI endpoints, internal bearer authentication, response privacy, bounded concurrent work.
- `backend/src/services/intelligence-service.ts`: Express-to-Python adapter and financial field allowlist.
- `frontend/src/features/intelligence/`: forecasting controls, visualizations, explanations, and model details.

`POST /api/intelligence/forecast` requires the existing Surplus session. Its body contains only forecast options; it cannot select another user or submit a substitute transaction history. The API loads the verified user's current workspace, then releases the PostgreSQL transaction before contacting Python. RLS and existing source isolation still apply. SQLite's single-owner mode uses the same adapter.

Python receives financial fields needed for forecasting: dates, amounts, account type, category, merchant, future obligations, goals, user routine/optional labels, and bank-supplied purchase timestamps/city/region/country/payment channel where available. It receives no profile, email, password, JWT, Plaid token, street address, coordinates or raw transaction description. Models are fitted per request in memory, with no shared-user training, financial logs, cache, or persisted model artifacts. Forecast inference makes no outbound network calls. A separate, opt-in merchant enrichment endpoint can call Groq with cleaned descriptors; see [its setup and privacy boundaries](groq-merchant-enrichment.md). Express fetches only fixed public CPI coordinates from Statistics Canada and caches the public response for 24 hours. Responses use `Cache-Control: no-store`; invalid input errors do not echo financial payloads. The frontend does not store forecasts in browser storage.

Express persists bounded goal-date snapshots (IDs, dates, timestamps, fingerprints and aggregate input differences) in `surplus.forecast_history`, with forced RLS. A second short database transaction checks that the source data still matches before saving; inference never holds the workspace lock. History-only writes do not rewrite transactions or balances. Custom opening-cash/tuition scenarios do not replace the saved-plan baseline. Clear-data removes this history too. `PATCH /api/intelligence/habits/:id` changes the authenticated user's selected-source transaction treatment only; amount and categorization remain intact and the correction survives Plaid updates.

The public account-free demo displays a fixed report generated by this same Python service from the original fictional sample. It never calls a private API and clearly labels the fixed snapshot; edits to the disposable demo do not rebuild it. Regenerate it with `npx tsx scripts/generate-demo-forecast.ts`. Signed-in sample workspaces run the service with current saved demo data and editable assumptions. Forecast requests never save scenario changes or move money.

## Forecasting method

Merchant identities and deeper category labels are resolved before inference. The [transaction enrichment guide](transaction-enrichment.md) documents confidence, user corrections, processor ambiguity, and the model-input allowlist.

1. Filter to the selected workspace source and posted CAD history at/before the snapshot. Transfers are not spending. Positive unknown deposits, grants, loans, and other irregular receipts are not projected as repeating earnings. Refunds reduce their spending category. Pending outflows are separately reserved.
2. Detect repeating employment deposits and selected stable bills using at least three observations, interval regularity, amount stability, and recency. Detection is a hypothesis; it does not establish an active contract or continued employment.
3. Honor explicit future monthly expense plans instead of simultaneously modeling the same category. Tuition is scheduled explicitly. Saved earned funding or an explicitly confirmed work schedule replaces inferred employment income, even after the final payday. Future confirmed funds and expected earned funds count; already-received or applied funding does not get added again.
4. Aggregate residual variable spending and earnings into complete Monday-Sunday weeks. Short histories use a daily-rate baseline and do not claim learned accuracy.
5. Compare recent-average forecasts with standardized Ridge regression at 16+ complete weeks and histogram gradient boosting at 30+ weeks. Features use earlier weekly values, rolling means/variation, and a bounded seasonal calendar signal. Validation uses up to four non-overlapping, two-week future holdouts. Models never see later validation values during fitting or recursive prediction. A learned model must improve mean absolute holdout error by at least 5% to replace the baseline. Extrapolation is bounded to twice the observed maximum or three times the historical mean.
6. Simulate 400 paths by resampling forecast errors in two-week blocks, then add scheduled events. Show the 10th/50th/90th percentiles. Deterministic seeds and common random draws make what-if comparisons repeatable. Variable spending uses a smoothed weekday profile after four complete weeks, otherwise uniform days. Variable earnings are spread evenly; detected or entered pay and bill dates remain explicit. Dates are estimates, not a reconstruction of actual daily bank balances.
7. When available, normalize historical variable spending to the latest published category CPI, then compound its year-over-year rate forward as an explicit scenario. Holdout errors use restated history, not historical CPI release vintages. Fixed entered bills, tuition, income and nominal goal targets are not silently inflated. A second chart path holds future prices constant. See [behavioral and economic methods](behavioral-intelligence.md).

This follows the principle of chronological forecasting evaluation described in [scikit-learn's lagged-feature forecasting example](https://scikit-learn.org/stable/auto_examples/applications/plot_time_series_lagged_features.html). The service uses [FastAPI security dependencies](https://fastapi.tiangolo.com/reference/security/) for internal authentication.

## What the results mean

- **Tuition:** cash after the scheduled bill, existing savings reserves, and minimum balance; median shortfall, extra weekly money needed, first median cash coverage, and simulated deadline readiness. The first coverage date can be temporary. Bills due today or earlier need review; beyond-horizon bills need a longer horizon.
- **Goals:** all goals compete for one pool, ordered by priority and deadline. Existing goal savings are assumed to be inside current cash. Additional allocations preserve the lowest modeled remaining balance through the horizon, including future tuition. A goal contribution setting is not new income.
- **What-if:** adds assumed extra monthly cash and reduces only modeled variable flexible spending. It does not reduce tuition/rent or silently edit the saved budget.
- **Patterns and anomalies:** estimated recurring payments and unusually large purchases relative to earlier category behavior. These do not identify fraud or guarantee future charges.
- **Assistant:** topic-based answers grounded in this report, not a generative chatbot. It cannot invent investment advice or pretend to know missing bank information.
- **About these estimates:** training weeks, holdout weeks, each candidate's weekly MAE, selection rationale, snapshot date, exclusions, and explicit assumptions.

## Limits that matter

The page also includes [spending-based Canadian card comparisons](credit-card-comparisons.md). These use explicit rewards rules and reviewed issuer terms, separate from the learned forecasting models.

Simulation shares are **not calibrated probabilities** and percentile bands are **not guaranteed confidence intervals**. Validation measures residual weekly forecasting, not the accuracy of manually entered bills, detected recurring contracts, or goal success. A narrow band can still be wrong after a job change or missing purchase history.

Observed history length is not proof of full bank coverage. Unlinked accounts, incomplete imports, stale balances, currency exclusions, and inaccurate category corrections affect results. Credit-only connections need a cash balance to estimate affordability. Pending charges may already be reflected in a bank's current balance; the explicit reserve can be conservative. Saved goal amounts must already be included in current cash. Recurring plans continue through the forecast horizon unless their funding end date is set.

The engine does not forecast exchange rates, investment returns, credit scores, admission decisions, or tax outcomes. It does not initiate transfers, pay tuition, or train a cross-user foundation model. Reports refresh on page entry and when the open page receives changed workspace data. Opt-in six-hour bank polling rebuilds the forecast while the backend is running; no push notifications are sent. The new action plan, review workflow, semester adjustments and future accuracy journal are described in [Plaid features and public data](intelligence-data-sources.md).

## Verification

`npm run test:intelligence` exercises financial exclusions, income/expense deduplication, cash reserves, goal competition, tuition gaps, date boundaries, sparse history, model selection, reproducible scenarios, and service authentication. `npm test` includes gateway privacy and error handling. `npm run test:postgres` includes per-account isolation and released-lock verification. `npm run test:e2e:intelligence` starts a real isolated Python service and Express app, then verifies scenario controls, tuition, assistant explanations, service failure, sparse data, responsive charts, and accessibility.
