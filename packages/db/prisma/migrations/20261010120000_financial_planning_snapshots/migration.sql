ALTER TABLE companies ADD COLUMN minimum_cash_reserve_cents BIGINT NOT NULL DEFAULT 0 CHECK (minimum_cash_reserve_cents >= 0);
ALTER TABLE categories ADD COLUMN cost_behavior TEXT NOT NULL DEFAULT 'UNCLASSIFIED' CHECK (cost_behavior IN ('UNCLASSIFIED', 'FIXED', 'VARIABLE'));
ALTER TABLE titles ADD COLUMN expected_receipt_date DATE, ADD COLUMN promised_receipt_date DATE,
  ADD COLUMN receipt_probability_bps INTEGER NOT NULL DEFAULT 10000 CHECK (receipt_probability_bps BETWEEN 0 AND 10000),
  ADD COLUMN cash_planning_note TEXT;
CREATE TABLE report_snapshots (
  id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  period TEXT NOT NULL CHECK (period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  kind TEXT NOT NULL CHECK (kind IN ('CLOSING', 'PDF')), version INTEGER NOT NULL CHECK (version > 0),
  as_of_date DATE NOT NULL, created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by_user_id TEXT NOT NULL, calculation_version TEXT NOT NULL, payload JSONB NOT NULL, source_key TEXT,
  UNIQUE(company_id, period, kind, version), UNIQUE(company_id, source_key)
);
CREATE INDEX report_snapshots_company_period_created_idx ON report_snapshots(company_id, period, created_at);
GRANT SELECT, INSERT ON report_snapshots TO ax_app;
ALTER TABLE report_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_snapshots FORCE ROW LEVEL SECURITY;
CREATE POLICY report_snapshots_company_access ON report_snapshots FOR ALL
USING (company_id = current_setting('app.current_company_id', true) AND EXISTS (
 SELECT 1 FROM memberships m WHERE m.company_id = report_snapshots.company_id
 AND m.user_id = current_setting('app.current_user_id', true) AND m.status = 'ACTIVE'
 AND (m.role = 'OWNER' OR m.access_scope = 'ALL')
))
WITH CHECK (company_id = current_setting('app.current_company_id', true) AND EXISTS (
 SELECT 1 FROM memberships m WHERE m.company_id = report_snapshots.company_id
 AND m.user_id = current_setting('app.current_user_id', true) AND m.status = 'ACTIVE'
 AND (m.role = 'OWNER' OR m.access_scope = 'ALL')
));
