# PostgreSQL and Supabase

The Express backend connects directly to PostgreSQL using `pg`. Supabase is the database host; the app keeps its custom username/password, JWT, OAuth and email authentication. React only talks to the Express API. A Supabase publishable key, service-role key and enabled Data API are not needed for this architecture.

## Configuration

Save the URI from Supabase **Connect → Direct → Session pooler** (IPv4-compatible), or a reachable direct connection, as `DATABASE_URL` in the root `.env`. Replace the entire `[YOUR-PASSWORD]` placeholder, including brackets. Percent-encode reserved password characters in the URI. Quotes around the complete dotenv value are optional. Never add a `VITE_` prefix to database or Plaid credentials.

```dotenv
DATABASE_URL="postgresql://USER:ENCODED_PASSWORD@HOST:5432/postgres"
```

```sh
npm run db:check
npm run db:migrate
npm run dev
```

The server selects PostgreSQL when `DATABASE_URL` is present, and refuses to start if its connection or required schema is unavailable. It never silently switches to local storage after a database error. Omit the URL to use the original local SQLite mode. Switching modes does not copy or delete existing data.

Remote connections verify the TLS certificate and hostname. Supabase connections use the bundled public CA in `backend/certificates/supabase-ca.crt`; `DATABASE_CA_FILE` can provide another trusted CA. URI SSL flags cannot disable verification. Only loopback database connections permit plaintext.

## Schema and ownership

Migration files are in `backend/migrations/`. Their checksums and application times are recorded under `surplus_migrations`. Migrations run atomically under a database advisory lock. Applied migration files must not be edited; add a new numbered migration.

| Schema         | Tables                                                    | Purpose                                                                   |
| -------------- | --------------------------------------------------------- | ------------------------------------------------------------------------- |
| `surplus_auth` | `users`, `identities`, `sessions`, `imports`              | Custom accounts, revocation, provider ownership and local import receipts |
| `surplus`      | `workspaces`                                              | Profile, semester, scenario and source settings                           |
| `surplus`      | `bank_accounts`, `transactions`, `plaid_connections`      | User-owned bank data and encrypted access tokens                          |
| `surplus`      | `funding`, `planned_expenses`, `savings_goals`, `budgets` | Individual plan records, including SQL numeric amount columns             |
| `surplus`      | `merchant_rules`, `applications`, `resource_progress`     | Categorization, applications, resource notes and follow-ups               |

All financial tables have `user_id`, foreign keys and forced row-level security. Within each operation, the backend verifies the JWT and persisted session, switches to the `surplus_runtime` role, and sets the transaction-local user ID. Neither request bodies nor query parameters select the account. Composite foreign keys prevent transactions from referencing another user's bank account. A row lock on the user's workspace serializes updates; responses are sent after commit.

The domain repository works against an isolated in-memory snapshot inside that transaction. The PostgreSQL adapter reconstructs it from child records and commits changes atomically. Validated DTO payloads remain JSONB for compatibility, with SQL numeric projections for financial records. This is intentionally one active workspace per account, and snapshot replacement is appropriate for the current student-sized dataset; larger histories will need incremental repository writes. Financial calculations remain in the shared TypeScript domain; no Python forecasting service is introduced by this database integration.

The server's database login can manage auth records and switch roles; it is privileged and must stay private. RLS here is defense against missing ownership filters, not against a compromised backend. The browser cannot query these schemas directly. Keep the Supabase Data API disabled if it is unused. In Table Editor, select the `surplus` or `surplus_auth` schema to see the tables.

## Import your existing local plan

Registration always creates an empty workspace. It never claims the existing local plan or the shared `.env` Sandbox access token.

1. Create your account in the app. Remain on the welcome screen; do not start a demo or save another plan yet.
2. Run the command with the exact username you created:

   ```sh
   npm run db:import-local -- --username YOUR_USERNAME
   ```

3. Reload the app. Your plan, resource tracking, transactions, merchant rules and encrypted Plaid connection should appear under that account.

The command requires an existing account and an empty destination. It validates the local token's encryption key before importing, copies records and an import receipt in one transaction, refuses repeat imports, and preserves the original SQLite file. It is a local operator command, not a public HTTP endpoint. Do not pass a password or token on the command line.

Preserve `data/.token-key` or your configured `TOKEN_ENCRYPTION_KEY`; moving encrypted bank tokens without their key makes them unusable. `data/surplus.sqlite` also holds the existing generated JWT signing key when `JWT_SIGNING_KEY` is omitted. PostgreSQL holds all new account and financial data; the original SQLite file is retained for this key and legacy import. For another server, configure the same private keys explicitly and back them up securely.

Each new user can connect their own Plaid Sandbox account through Link or create a separate dynamic/student test Item. The global environment-token import is disabled in PostgreSQL mode so users cannot all claim the same test connection.

## Verification and deployment limits

```sh
npm run check
npm run test:postgres
npm run test:e2e
npm run test:e2e:postgres
```

The standard tests use isolated SQLite and no banking credentials. PostgreSQL tests use the configured database and create uniquely named temporary users, then remove only those users and their records. They cover account isolation, RLS, rollback, concurrent edits, token encryption, logout, local imports and real browser signup/login persistence. The PostgreSQL browser suite uses port 3003 and no live Plaid/OAuth/SMTP credentials. Build the frontend before running browser suites.

This remains a locally hosted app with a remote database, not a completed public deployment. OAuth flow state, email challenges and abuse limits are process-local. Public multi-instance hosting still needs shared challenge/rate-limit storage, account recovery, managed key storage, an HTTPS origin, backup/restore procedures and deployment configuration. Google/Microsoft and SMTP still require their own credentials; a database connection does not activate those services.
