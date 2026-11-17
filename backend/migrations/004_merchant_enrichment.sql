CREATE TABLE surplus.merchant_enrichment (
  user_id uuid PRIMARY KEY REFERENCES surplus.workspaces(user_id) ON DELETE CASCADE,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE surplus.merchant_enrichment ENABLE ROW LEVEL SECURITY;
ALTER TABLE surplus.merchant_enrichment FORCE ROW LEVEL SECURITY;
CREATE POLICY account_isolation ON surplus.merchant_enrichment TO surplus_runtime
  USING (user_id = nullif(current_setting('surplus.user_id', true), '')::uuid)
  WITH CHECK (user_id = nullif(current_setting('surplus.user_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON surplus.merchant_enrichment TO surplus_runtime;
REVOKE ALL ON surplus.merchant_enrichment FROM PUBLIC;
