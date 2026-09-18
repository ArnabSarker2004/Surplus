# Activate Google and Microsoft signup / login

The provider flows are implemented in the Express backend and use your existing PostgreSQL account tables. A first successful provider sign-in creates a private account; subsequent sign-ins with the same provider identity return to that account. No Supabase Auth setup is needed.

The remaining step is creating OAuth applications that belong to you. Their credentials are separate from your database and Plaid credentials. Keep the client secrets in the ignored root `.env`.

You register **Surplus once** with each provider. Students then use their own Google or Microsoft accounts; they do not create developer projects or supply client secrets. Surplus has no email allowlist or university-domain restriction.

## Use this address consistently

For this local setup, use **http://localhost:5173** and set:

```dotenv
AUTH_PUBLIC_ORIGIN=http://localhost:5173
```

The browser address, this value, and the redirect URIs below must agree. Switching between `localhost` and `127.0.0.1` during sign-in loses the browser's flow cookie. The app now detects this mismatch before redirecting. The API runs on port 3001, but Vite proxies the callbacks from the browser's port 5173.

## Google

1. Open [Google Auth Platform](https://console.cloud.google.com/auth/overview) using the Google account that should own Surplus. Create or select a project named **Surplus**.
2. Complete **Branding / Get started**: application name **Surplus**, your support email, and your developer contact email.
3. For **Audience**, choose **External** to support Google accounts outside your organization. For public launch, use **Publish app** to set the status to **In production**. Surplus requests only `openid email profile`: Google's basic sign-in exception means users do not have to be on the test-user list even while testing. Additional Google API scopes can change that behavior. See [Google's audience and publishing rules](https://support.google.com/cloud/answer/15549945?hl=en).
4. Under **Clients**, choose **Create client**, type **Web application**, name **Surplus Local**.
5. Add this exact **Authorized redirect URI**:

   ```text
   http://localhost:5173/api/auth/oauth/google/callback
   ```

   If you fill in **Authorized JavaScript origins**, use `http://localhost:5173`. This backend redirect flow does not need a browser Google SDK.

6. Create the client and immediately save its **Client ID** and **Client secret** privately in `.env`:

   ```dotenv
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-client-secret
   ```

The app requests only `openid email profile`. You do not need Gmail, Drive, Calendar or banking permissions. See [Google's OpenID setup](https://developers.google.com/identity/openid-connect/openid-connect) and [web application credential instructions](https://developers.google.com/identity/protocols/oauth2/web-server#creatingcred).

## Microsoft

1. Open the [Microsoft Entra admin center](https://entra.microsoft.com/) with an account allowed to register applications in your tenant. If you cannot access **App registrations**, you need a tenant and the relevant permissions; the ability to sign in with Outlook alone does not establish those permissions.
2. Go to **Entra ID → App registrations → New registration**. Name it **Surplus Local**.
3. Select the account audience for **any organizational directory plus personal Microsoft accounts** (also shown as **Any Entra ID Tenant + Personal Microsoft accounts**). This covers participating school/work accounts and personal Outlook/Hotmail accounts.
4. Under **Authentication → Add a platform**, choose **Web** and register:

   ```text
   http://localhost:5173/api/auth/oauth/microsoft/callback
   ```

   The backend handles the code exchange, so use the Web platform. This flow does not require the implicit grant checkboxes.

5. Copy **Application (client) ID** from Overview.
6. Open **Certificates & secrets → Client secrets → New client secret**. Save the new secret's **Value** immediately; **Secret ID** is a different field. Note its expiry so it can be replaced before it expires.
7. Fill in these fields in `.env`:

   ```dotenv
   MICROSOFT_CLIENT_ID=your-application-client-id
   MICROSOFT_CLIENT_SECRET=your-secret-value
   MICROSOFT_TENANT_ID=common
   ```

The app requests `openid email profile`, with an account chooser. School administrators may restrict consent. Microsoft documents [app registration and supported account types](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app) and [redirect URI rules](https://learn.microsoft.com/en-us/entra/identity-platform/reply-url).

This audience accepts personal Microsoft accounts and accounts from other participating work/school organizations. You do not need to invite each student into your own tenant. Organization administrators can still restrict third-party sign-in for managed accounts.

## Let other people access Surplus

Provider account eligibility and hosting are separate. The current localhost address works on your computer. For a public launch, deploy the app at an HTTPS address, set `AUTH_PUBLIC_ORIGIN` to it, and register its exact Google/Microsoft callbacks in the provider consoles. Selecting Google's production audience does not deploy the app. Managed Google Workspace and Microsoft school/work accounts remain subject to their administrators' access policies.

## Check and try it

```sh
npm run auth:check
npm run auth:check -- --provider google --probe
npm run auth:check -- --provider microsoft --probe
```

The check prints missing **field names** and exact public callback URLs, never credential values. It exits with a nonzero status for incomplete setup. `--probe` verifies discovery and authorization URL construction; it cannot prove that a client secret or registered callback is accepted. A browser sign-in is the final check.

Restart the development server after editing `.env`, then open **http://localhost:5173**. The configured buttons become enabled automatically on both the signup and login views.

- For a new account, click **Continue with Google** or **Continue with Microsoft**, choose an account, and complete consent. You should reach Surplus onboarding.
- For an existing password account, sign in first and connect the provider through **Settings → Your ways in** within five minutes. This keeps your saved plan in the same account. Matching email labels do not automatically merge accounts.
- Log out, sign in with that provider again, and confirm the saved plan returns.

Google `redirect_uri_mismatch` or Microsoft `AADSTS50011` means the registered callback does not match the app's URI. An unavailable button means local configuration is missing or invalid. A failed sign-in after consent can also mean an incorrect/expired secret or provider account restriction.
