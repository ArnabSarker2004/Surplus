# Canadian bank coverage check

Checked September 18, 2026. This is a practical ten-institution/brand shortlist, not a statistically ranked list of customer popularity. Desjardins is a cooperative financial group; Simplii is a CIBC division.

The six large banks are identified by [OSFI](https://www.osfi-bsif.gc.ca/en/guidance/guidance-library/capital-adequacy-requirements-car-2026-chapter-1-overview-risk-based-capital-requirements). The additional choices reflect established consumer banking options: [Desjardins](https://www.desjardins.com/en/about-us.html), [Tangerine](https://www.tangerine.ca/en/about-us), [Simplii](https://www.simplii.com/en/about-us.html), and [EQ Bank](https://www.eqbank.ca/about-us/about).

## Actual API results

Queries used `/institutions/search`, `country_codes: ["CA"]`, and `products: ["transactions"]` with the existing Sandbox credentials. The following retail matches were returned; investment/business and unrelated search candidates were excluded from this summary.

| Banking option | Plaid catalogue name | Sandbox institution ID |
| --- | --- | --- |
| RBC | RBC Royal Bank | ins_39 |
| TD | TD Canada Trust | ins_42 |
| Scotiabank | Scotiabank | ins_38 |
| BMO | BMO Bank of Montreal | ins_41 |
| CIBC | CIBC | ins_37 |
| National Bank | National Bank of Canada | ins_48 |
| Desjardins | Desjardins | ins_46 |
| Tangerine | Tangerine - Personal | ins_40 |
| Simplii | Simplii Financial | ins_115631 |
| EQ Bank | EQ Bank | ins_122886 |

All ten returned Canadian Transactions catalogue matches in **Sandbox and Production**. The Production lookup succeeded using the configured Trial credentials on September 18, 2026. This is not evidence of a successful real-account connection, production availability, current institution health, or the Trial team's institution entitlements. No real accounts were connected and no transaction data was requested.

## Repeat the check

```sh
npm run plaid:check-banks -- --environment sandbox
npm run plaid:check-banks -- --environment production
```

Production is the default, and requires `PLAID_PRODUCTION_SECRET` plus the matching `PLAID_CLIENT_ID` in the ignored root `.env`. It never falls back to Sandbox. The command is a separate read-only diagnostic. Use the app?s Connect my bank button to begin a real connection.

Reports are saved under ignored `artifacts/canadian-banks-{environment}.json`. They contain institution metadata only. The Production catalogue check passed for all ten retail matches. The [live-banking flow](live-banking-setup.md) is implemented. The account owner must complete Plaid Link for their own bank. Catalogue presence does not verify a completed Link session or successful transaction synchronization.

Reference: [Plaid Institutions API](https://plaid.com/docs/api/institutions/).
