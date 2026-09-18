-- Application-owned schemas; nothing is exposed through Supabase's Data API.
CREATE SCHEMA surplus_auth;
CREATE SCHEMA surplus;
REVOKE ALL ON SCHEMA surplus_auth, surplus FROM PUBLIC;

CREATE TABLE surplus_auth.users (
  id uuid PRIMARY KEY,
  username text NOT NULL UNIQUE CHECK (length(username) BETWEEN 3 AND 254),
  password jsonb,
  email text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE surplus_auth.identities (
  provider text NOT NULL CHECK (provider IN ('google','microsoft','apple')),
  subject text NOT NULL,
  user_id uuid NOT NULL REFERENCES surplus_auth.users(id) ON DELETE CASCADE,
  label text NOT NULL,
  PRIMARY KEY (provider, subject),
  UNIQUE (user_id, provider)
);
CREATE TABLE surplus_auth.sessions (
  hash text PRIMARY KEY CHECK (length(hash) = 64),
  user_id uuid NOT NULL REFERENCES surplus_auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user ON surplus_auth.sessions(user_id);

-- One active workspace per account, preserving the frontend's current contract.
CREATE TABLE surplus.workspaces (
  user_id uuid PRIMARY KEY REFERENCES surplus_auth.users(id) ON DELETE CASCADE,
  payload jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE surplus.bank_accounts (
  user_id uuid NOT NULL REFERENCES surplus.workspaces(user_id) ON DELETE CASCADE,
  id text NOT NULL,
  payload jsonb NOT NULL,
  balance numeric(16,2) GENERATED ALWAYS AS ((payload->>'balance')::numeric) STORED,
  currency text GENERATED ALWAYS AS (payload->>'currency') STORED,
  PRIMARY KEY(user_id,id)
);
CREATE TABLE surplus.transactions (
  user_id uuid NOT NULL,
  id text NOT NULL,
  account_id text NOT NULL,
  payload jsonb NOT NULL,
  amount numeric(16,2) GENERATED ALWAYS AS ((payload->>'rawAmount')::numeric) STORED,
  transaction_date text GENERATED ALWAYS AS (payload->>'date') STORED,
  category text GENERATED ALWAYS AS (payload->>'category') STORED,
  PRIMARY KEY(user_id,id),
  FOREIGN KEY(user_id,account_id) REFERENCES surplus.bank_accounts(user_id,id) ON DELETE CASCADE
);
CREATE INDEX transactions_user_date ON surplus.transactions(user_id,transaction_date);
CREATE TABLE surplus.plaid_connections (
  user_id uuid PRIMARY KEY REFERENCES surplus.workspaces(user_id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  item_id text GENERATED ALWAYS AS (payload->>'id') STORED,
  CHECK (payload ? 'encryptedToken')
);

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['funding','planned_expenses','savings_goals','budgets','merchant_rules','applications','resource_progress'] LOOP
    EXECUTE format('CREATE TABLE surplus.%I (user_id uuid NOT NULL REFERENCES surplus.workspaces(user_id) ON DELETE CASCADE, id text NOT NULL, position integer NOT NULL DEFAULT 0, payload jsonb NOT NULL, PRIMARY KEY(user_id,id))', table_name);
  END LOOP;
END $$;
ALTER TABLE surplus.funding ADD COLUMN amount numeric(16,2) GENERATED ALWAYS AS ((payload->>'amount')::numeric) STORED;
ALTER TABLE surplus.planned_expenses ADD COLUMN amount numeric(16,2) GENERATED ALWAYS AS ((payload->>'amount')::numeric) STORED;
ALTER TABLE surplus.budgets ADD COLUMN budget_limit numeric(16,2) GENERATED ALWAYS AS ((payload->>'limit')::numeric) STORED;
ALTER TABLE surplus.budgets ADD COLUMN category text GENERATED ALWAYS AS (payload->>'category') STORED;
CREATE UNIQUE INDEX budgets_one_per_category ON surplus.budgets(user_id,category);
ALTER TABLE surplus.savings_goals ADD COLUMN target numeric(16,2) GENERATED ALWAYS AS ((payload->>'target')::numeric) STORED;

-- NOLOGIN role used with SET LOCAL ROLE inside every financial unit of work.
-- The server verifies the session before setting the transaction-local user ID.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'surplus_runtime') THEN
    CREATE ROLE surplus_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS;
  END IF;
  EXECUTE format('GRANT surplus_runtime TO %I', current_user);
END $$;
GRANT USAGE ON SCHEMA surplus TO surplus_runtime;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA surplus TO surplus_runtime;
DO $$
DECLARE table_name text;
BEGIN
  FOR table_name IN SELECT tablename FROM pg_tables WHERE schemaname = 'surplus' LOOP
    EXECUTE format('ALTER TABLE surplus.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE surplus.%I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('CREATE POLICY account_isolation ON surplus.%I TO surplus_runtime USING (user_id = nullif(current_setting(''surplus.user_id'',true),'''')::uuid) WITH CHECK (user_id = nullif(current_setting(''surplus.user_id'',true),'''')::uuid)', table_name);
  END LOOP;
END $$;

-- Explicit import ledger prevents duplicate migration of an existing local workspace.
CREATE TABLE surplus_auth.imports (
  fingerprint text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES surplus_auth.users(id),
  imported_at timestamptz NOT NULL DEFAULT now()
);
