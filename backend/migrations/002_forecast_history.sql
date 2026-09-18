-- Small per-account forecast summaries; no raw transaction copies or shared models.
CREATE TABLE surplus.forecast_history (
  user_id uuid PRIMARY KEY REFERENCES surplus.workspaces(user_id) ON DELETE CASCADE,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE surplus.forecast_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE surplus.forecast_history FORCE ROW LEVEL SECURITY;
CREATE POLICY account_isolation ON surplus.forecast_history TO surplus_runtime
  USING (user_id = nullif(current_setting('surplus.user_id', true), '')::uuid)
  WITH CHECK (user_id = nullif(current_setting('surplus.user_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON surplus.forecast_history TO surplus_runtime;
REVOKE ALL ON surplus.forecast_history FROM PUBLIC;
