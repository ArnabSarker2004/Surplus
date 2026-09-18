# Sign-in, identity providers and logout

With `DATABASE_URL` configured, Surplus supports separate accounts through **Create account** and **Sign in**. PostgreSQL stores users, password hashes, linked identities and revocable sessions. Each account owns an isolated workspace. Authentication remains custom; Supabase Auth is not used. Without `DATABASE_URL`, the original one-owner local workspace remains available.

Google, Microsoft and one-time email codes become available after their server credentials are configured. In PostgreSQL mode, a new provider identity or verified email creates a separate account. To add it to an existing password account, explicitly connect it in **Settings / Your ways in** first. Matching provider email labels never automatically merge accounts. Existing local plans and bank connections require an explicit [account import](database.md#import-your-existing-local-plan).

## Provider choice and research

Research checked September 17, 2026. These choices are based on documented product support and university infrastructure, not measured student market share.

| Method         | Rationale                                                                                                | Implementation                                                                                                       |
| -------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Google         | TMU uses Google Workspace; comparable budgeting apps support Google.                                     | OpenID Connect with authorization code, PKCE, state and nonce.                                                       |
| Microsoft      | Covers personal Outlook/Hotmail accounts and participating school/work Microsoft accounts.               | OpenID Connect with PKCE; `common` tenant supports both account families when the app registration permits them.     |
| Email code     | A provider-independent option for Gmail, Outlook, iCloud, Yahoo, school and other deliverable addresses. | Six-digit, one-use, browser-bound code, delivered through authenticated SMTP.                                        |
| Local password | Keeps the local app usable without external services.                                                    | Existing username and salted scrypt password authentication.                                                         |

Evidence: [Monarch's Google and email sign-in](https://help.monarch.com/hc/en-us/articles/35673146932628-FAQ-Login-Issues-Security), [YNAB account guidance](https://support.ynab.com/en_us/changing-your-email-and-password-a-guide-SJq60jfRq), [TMU Google Workspace](https://www.torontomu.ca/google/), [Microsoft OpenID Connect](https://learn.microsoft.com/en-us/entra/identity-platform/v2-protocols-oidc). School administrators can restrict third-party applications; this integration does not imply TMU approval or official university SSO.

Facebook, GitHub, LinkedIn, SMS and passkeys are not included in this release. The researched budgeting-app examples support prioritizing Google and email; Microsoft extends access to personal and school accounts. Passkeys and MFA are separate future security work, rather than additional email providers.

## Setup

For the current Google/Microsoft setup, follow [the exact local registration walkthrough](social-login-setup.md). `npm run auth:check` reports missing fields and callback URLs without printing secrets.

Keep credentials in the ignored root `.env`. Never use `VITE_` for secrets and never commit credentials. The existing Plaid credentials are unrelated to these provider applications. Start from the variable names in [`.env.example`](../.env.example), preserving existing banking configuration. Restart the API after changes.

Choose one exact browser origin and use it consistently. Development defaults to `http://127.0.0.1:5173`. For Microsoft, `http://localhost:5173` is the easiest loopback origin to register through its portal; set `AUTH_PUBLIC_ORIGIN=http://localhost:5173` and use that address for all providers. The compiled app on port 3001 needs `AUTH_PUBLIC_ORIGIN=http://localhost:3001` (and matching registered callbacks). Never register the frontend callback against the API's development port when the browser uses port 5173.

### Google

1. In [Google Cloud's auth platform](https://console.cloud.google.com/auth/overview), create/select the Surplus project, configure branding, and choose the **External** audience. Use **In production** for public launch. With the app's basic `openid email profile` scopes, Google does not require a test-user allowlist even while testing. See [Google's audience rules](https://support.google.com/cloud/answer/15549945?hl=en).
2. Create an OAuth client of type **Web application**.
3. Add the exact redirect URI `{AUTH_PUBLIC_ORIGIN}/api/auth/oauth/google/callback`.
4. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`.

Only `openid email profile` is requested; Gmail inbox, contacts, calendar and financial data permissions are not requested. [Google's setup and OIDC documentation](https://developers.google.com/identity/openid-connect/openid-connect).

### Microsoft

1. Register Surplus in the [Microsoft Entra admin center](https://entra.microsoft.com/).
2. Choose **Accounts in any organizational directory and personal Microsoft accounts** if both school and Outlook/Hotmail accounts should work.
3. Add a **Web** redirect URI `{AUTH_PUBLIC_ORIGIN}/api/auth/oauth/microsoft/callback`, rather than an SPA redirect.
4. Create a client secret. Set `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` (the secret value, not its ID) and `MICROSOFT_TENANT_ID=common`.

Tenant-specific UUIDs, `organizations` and `consumers` are also supported. Only identity scopes are requested. Some schools require administrator consent. Microsoft documents special handling for HTTP loopback IP addresses; prefer `localhost` during local registration. [OIDC configuration](https://learn.microsoft.com/en-us/entra/identity-platform/v2-protocols-oidc), [redirect URI rules](https://learn.microsoft.com/en-us/entra/identity-platform/reply-url).

### Email codes (all email inbox providers)

Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` and `SMTP_FROM` using a verified sender at your email-delivery provider. The recipient can use any supported inbox; you do not need a separate OAuth integration for Yahoo or iCloud email codes. Nodemailer requires TLS: implicit TLS on 465, STARTTLS otherwise (normally 587), with certificate validation enabled.

For example, [Resend SMTP](https://resend.com/docs/send-with-smtp) uses `smtp.resend.com`, user `resend`, and an API key as the password. [Postmark SMTP](https://postmarkapp.com/developer/user-guide/send-email-with-smtp), Amazon SES and SendGrid can use the same adapter with their respective SMTP credentials. Configure sender/domain verification, SPF/DKIM and provider sending permissions in that service. Personal Gmail/Outlook SMTP settings and school policies vary; use a transactional sender for app email. [Nodemailer SMTP documentation](https://nodemailer.com/smtp).

An existing password owner first signs in, connects their email under Settings, and enters the emailed code. Thereafter they can choose **Email code** at login. This provides an alternate way in even if they forget the local password, provided email was linked beforehand. There is no password reset workflow for an owner who has not connected an alternate method.

### Smoke check after configuration

1. Restart `npm run dev`, visit the configured origin, and confirm the relevant method is enabled.
2. If the workspace already has an owner, sign in with the existing method. Within five minutes, connect the provider/email from Settings. Complete consent or enter the code.
3. Log out. Sign in with the newly connected method and verify that the same plan appears.
4. Cancel provider consent, request an expired/incorrect email code, and confirm errors leave the account signed out.

The provider readiness endpoint reports presence of required configuration, not a successful provider connectivity probe. No real OAuth credentials or SMTP sender were supplied for this work, so real provider consent and email delivery still require this smoke check. Automated tests use fake delivery, controlled provider responses and real signed OpenID tokens; they never send email or create credentials in the user's workspace.

## Session and identity security

- `jsonwebtoken` issues HS256 JWTs with a random `jti`, fixed `iss=surplus`, `aud=surplus-api`, `sub=<user UUID>` in PostgreSQL mode (`workspace-owner` locally), issued-at and expiration. Verification pins all these expected values and the algorithm. No financial data, email, provider tokens or secrets are in the JWT.
- `JWT_SIGNING_KEY` can be supplied as 64 hex characters; otherwise a persistent random 256-bit key is generated in the local database under `auth.signingKey`, excluded from exports. Changing this key invalidates sessions. Old opaque sessions require a fresh login after this upgrade; account passwords and workspace data are preserved.
- JWTs are stored only in HttpOnly, SameSite=Strict cookies, with Secure for HTTPS, and never exposed in JSON or localStorage. Every authenticated request also checks a persisted SHA-256 session hash and idle/absolute expiry. This deliberate server-side session record enables immediate revocation despite a valid JWT signature.
- Sessions last at most seven days, expire after 30 minutes without private API activity, and are capped at ten. Status polling does not extend idle lifetime. Sign-in rotates the current session. No refresh token is stored in the browser.
- Logout revokes the session, expires its cookie, unmounts private UI, clears Surplus onboarding drafts, and clears other tabs through BroadcastChannel/storage events. A failed logout stays visibly failed with retry. Saved workspace data and the bank connection are retained. Deleting workspace data retains authentication records.
- Passwords use async scrypt (`N=131072, r=8, p=1`) with independent random salts. Five failed password attempts within 15 minutes (per username in PostgreSQL mode) are throttled; expensive hashing is serialized.
- `openid-client` discovers provider metadata, validates state, nonce, issuer, audience, time claims and ID-token signatures (non-repudiation checks enabled). Google/Microsoft use PKCE. Provider access/refresh tokens are discarded; only issuer/subject identity and a display label are retained.
- OAuth flow state lives on the server for ten minutes and is bound to an HttpOnly browser cookie. It is consumed once, including on failure. Google/Microsoft callbacks use SameSite=Lax flow cookies. The main application session remains Strict. Only the exact callback paths bypass cross-site write checks, and they still require valid state and browser binding.
- Email codes are cryptographically random, hashed with the challenge ID, browser-bound, consumed once, valid for ten minutes and limited to five guesses. Three send requests per address and fifteen overall per 15 minutes limit mail abuse. Reissuing a code invalidates previous challenges for that address. In local one-owner mode, unknown/unlinked addresses receive a generic response and no code; PostgreSQL mode permits verified email signup. delivery timing is not guaranteed to be indistinguishable.
- Linking/removing a method requires a session created within five minutes. Completing a pending link rechecks the original session, including revocation. The last remaining sign-in method cannot be removed. No account linking occurs merely because email labels match.

Flow state and throttles are process-local; restart cancels pending codes/OAuth and resets counters. PostgreSQL mode supports separate accounts and per-user data isolation. Public multi-instance deployment still needs shared abuse controls, recovery, operational monitoring, proxy configuration and deployment testing. OS-account access can read the local database and configuration; app authentication does not encrypt the entire filesystem.

## Structure and validation

`shared/auth.ts` defines safe public contracts. `repositories/auth-repository.ts` persists authentication separately from workspace documents. `services/auth-service.ts` manages JWT sessions and ownership; `services/email-auth-service.ts` owns challenges. `integrations/identity-providers.ts` and `auth-mail.ts` isolate external services. `routes/auth-routes.ts` and `identity-routes.ts` handle HTTP. `frontend/src/features/auth/` contains the premium entry screen, provider controls, email-code form, account settings and authenticated boundary.

Tests cover existing-data adoption, JWT tampering, revocation, idle/absolute expiry, state theft/replay, cancellation, callback CSRF exceptions, actual signed OpenID token validation, email expiry/replay/guess limits, delivery failure, recent-session linking, last-method protection, logout across tabs, mobile layout and accessibility. End-to-end tests use an isolated database in `data/e2e`.
