# Connecting your own spending data

Checked against Plaid documentation on September 18, 2026.

## Current implementation

Surplus supports separate Sandbox and Production connections. Set `PLAID_CLIENT_ID` and `PLAID_PRODUCTION_SECRET` privately in `.env`, restart the backend, and use **Connect my bank** in the dedicated **Your bank** setup step or Settings. The Canadian institution picker requests Transactions only. Sandbox credentials and fixtures remain separate.

Both the six-step quick setup and nine-step full setup include banking before review. It is optional. Users connect credit-card accounts through the issuing institution in Plaid; Surplus never asks for card numbers, expiry dates, CVVs, PINs, or bank passwords. Connected transactions feed spending insights and an optional local Python forecasting service. Models fit only the requesting workspace when the user builds a forecast; see [financial intelligence](financial-intelligence.md). The public `/#demo` route uses an isolated fictional student workspace, with no real bank connection or private workspace requests.

A successful Link session exchanges the public token server-side and stores the encrypted access token under the signed-in account. The UI immediately attempts transaction sync. If history is not ready, use **Sync transactions** again; a temporary sync failure keeps the connection and prior data. **Reconnect bank** uses update mode for the existing Item. **Disconnect** revokes a live Item with Plaid before removing imported data.

The app supports one bank Item per user, including multiple accounts from that bank. Analytics include posted CAD transactions and exclude transfers from spending totals. Bank deposits are not automatically added to manually entered planned funding. OAuth-return support for institutions that require redirects and continuous webhook/background synchronization remain future work; the current flow targets Canadian institutions using the standard Link flow.

The production Link-token request was verified on September 18, 2026. No real bank account was connected during development. Automated lifecycle tests use mocked responses, never real customer transactions.

## Your Plaid dashboard setup

1. Check the account's plan in the [Plaid Dashboard](https://dashboard.plaid.com/). Eligible US/Canada developers can use a Trial plan with real production data; older accounts may have Limited Production access instead. Check the dashboard before applying for a paid upgrade.
2. Enable/request the **Transactions** product. Surplus needs transaction history for spending analysis; payment initiation is not required.
3. Configure the Link use-case description for personal finance management, including the app name Surplus, as required by Plaid's Link configuration.
4. Confirm that the desired bank, country, and account types support Transactions under the account's plan. The presence of a Sandbox institution does not establish live support.
5. Keep the Production secret in a private local environment file for live connections. Do not replace PLAID_SANDBOX_SECRET or paste bank credentials into chat. Bank authentication belongs in Plaid Link or the bank's authorization page.

The Trial plan currently permits up to 10 production Items. An Item is one user's connection to an institution and may contain multiple accounts. Removing an Item does not replenish that Trial allocation. Do not repeatedly create real connections as disposable automated test fixtures.

## Implementation and remaining scope

- Implemented explicit Sandbox/Production configuration with matching credentials and persist each connection's environment. Reject environment mismatches rather than silently treating test data as real.
- Implemented a separate live transaction/account source throughout validation, storage, categorization, reports, exports, and the UI. Keep demo and Sandbox records out of live spending totals.
- Use the signed-in user's identity for Link and exchange tokens server-side. Preserve encrypted, per-user token storage.
- Implemented update-mode reconnection for expired bank access, and revoke the Plaid Item on disconnect before clearing its local connection data.
- Check whether the chosen institution requires OAuth redirects. Add registered redirect handling and Link resumption when required.
- Start with explicit sync and clear last-updated/loading/error states. Continuous background tracking will need scheduled work or verified webhook handling on a reachable server; a closed local app cannot run background sync.
- Validate pending-to-posted transitions, refunds, transfers, credit-card payments, currency filtering, and duplicate avoidance with fixtures before connecting a real account.

No paid plan or public deployment was created. Development verification made a Production institution lookup and Link-token request; the account owner must complete Link consent before personal transactions can be imported.

## Official references

- [Trial plan eligibility, products and limits](https://support.plaid.com/hc/en-us/articles/39994173227159-What-is-the-Plaid-Trial-plan)
- [Sandbox, Trial and Limited Production differences](https://support.plaid.com/hc/en-us/articles/16110110883479-How-are-Sandbox-Production-Trial-plan-and-Limited-Production-different)
- [Transactions overview](https://plaid.com/docs/transactions/)
- [Bank OAuth requirements](https://plaid.com/docs/link/oauth/)
- [Link use-case configuration](https://plaid.com/docs/link/data-transparency-messaging-migration-guide/)
