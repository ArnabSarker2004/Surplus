-- Bounded forecast checkpoints and observed balance snapshots, scoped to each owner.
CREATE TABLE surplus.intelligence_journal (
  user_id uuid PRIMARY KEY REFERENCES surplus.workspaces(user_id) ON DELETE CASCADE,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE surplus.intelligence_journal ENABLE ROW LEVEL SECURITY;
ALTER TABLE surplus.intelligence_journal FORCE ROW LEVEL SECURITY;
CREATE POLICY account_isolation ON surplus.intelligence_journal TO surplus_runtime
  USING (user_id = nullif(current_setting('surplus.user_id', true), '')::uuid)
  WITH CHECK (user_id = nullif(current_setting('surplus.user_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON surplus.intelligence_journal TO surplus_runtime;
REVOKE ALL ON surplus.intelligence_journal FROM PUBLIC;
