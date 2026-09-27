CREATE TYPE "MembershipAccessScope" AS ENUM ('ALL', 'RESTRICTED');
CREATE TYPE "CostCenterStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "AttachmentScanStatus" AS ENUM ('NOT_SCANNED', 'CLEAN', 'INFECTED', 'ERROR');

ALTER TABLE "memberships"
  ADD COLUMN "access_scope" "MembershipAccessScope" NOT NULL DEFAULT 'ALL';

ALTER TABLE "titles"
  ADD COLUMN "cost_center_id" TEXT,
  ADD COLUMN "deleted_at" TIMESTAMP(3),
  ADD COLUMN "deleted_by_user_id" TEXT,
  ADD COLUMN "delete_reason" TEXT;

ALTER TABLE "recurrence_rules" ADD COLUMN "cost_center_id" TEXT;

ALTER TABLE "attachments"
  ADD COLUMN "storage_backend" TEXT NOT NULL DEFAULT 'LOCAL',
  ADD COLUMN "scan_status" "AttachmentScanStatus" NOT NULL DEFAULT 'NOT_SCANNED',
  ADD COLUMN "scanned_at" TIMESTAMP(3);

CREATE TABLE "cost_centers" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT,
  "status" "CostCenterStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "cost_centers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "cost_centers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "membership_financial_accounts" (
  "company_id" TEXT NOT NULL,
  "membership_id" TEXT NOT NULL,
  "financial_account_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "membership_financial_accounts_pkey" PRIMARY KEY ("membership_id", "financial_account_id")
);

CREATE TABLE "membership_cost_centers" (
  "company_id" TEXT NOT NULL,
  "membership_id" TEXT NOT NULL,
  "cost_center_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "membership_cost_centers_pkey" PRIMARY KEY ("membership_id", "cost_center_id")
);

CREATE UNIQUE INDEX "memberships_id_company_id_key" ON "memberships"("id", "company_id");
CREATE UNIQUE INDEX "memberships_one_active_owner_per_company" ON "memberships"("company_id")
  WHERE "role" = 'OWNER' AND "status" = 'ACTIVE';
CREATE UNIQUE INDEX "financial_accounts_id_company_id_key" ON "financial_accounts"("id", "company_id");
CREATE UNIQUE INDEX "categories_id_company_id_key" ON "categories"("id", "company_id");
CREATE UNIQUE INDEX "parties_id_company_id_key" ON "parties"("id", "company_id");
CREATE UNIQUE INDEX "recurrence_rules_id_company_id_key" ON "recurrence_rules"("id", "company_id");
CREATE UNIQUE INDEX "titles_id_company_id_key" ON "titles"("id", "company_id");
CREATE UNIQUE INDEX "settlements_id_company_id_key" ON "settlements"("id", "company_id");
CREATE UNIQUE INDEX "import_batches_id_company_id_key" ON "import_batches"("id", "company_id");
CREATE UNIQUE INDEX "cost_centers_id_company_id_key" ON "cost_centers"("id", "company_id");
CREATE UNIQUE INDEX "cost_centers_company_id_name_key" ON "cost_centers"("company_id", "name");
CREATE UNIQUE INDEX "cost_centers_company_id_code_key" ON "cost_centers"("company_id", "code");
CREATE INDEX "cost_centers_company_id_status_idx" ON "cost_centers"("company_id", "status");
CREATE INDEX "membership_financial_accounts_financial_account_id_idx" ON "membership_financial_accounts"("financial_account_id");
CREATE INDEX "membership_cost_centers_cost_center_id_idx" ON "membership_cost_centers"("cost_center_id");
CREATE INDEX "titles_company_id_deleted_at_idx" ON "titles"("company_id", "deleted_at");

ALTER TABLE "membership_financial_accounts" ADD CONSTRAINT "membership_financial_accounts_membership_company_fkey"
  FOREIGN KEY ("membership_id", "company_id") REFERENCES "memberships"("id", "company_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "membership_financial_accounts" ADD CONSTRAINT "membership_financial_accounts_account_company_fkey"
  FOREIGN KEY ("financial_account_id", "company_id") REFERENCES "financial_accounts"("id", "company_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "membership_cost_centers" ADD CONSTRAINT "membership_cost_centers_membership_company_fkey"
  FOREIGN KEY ("membership_id", "company_id") REFERENCES "memberships"("id", "company_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "membership_cost_centers" ADD CONSTRAINT "membership_cost_centers_cost_center_company_fkey"
  FOREIGN KEY ("cost_center_id", "company_id") REFERENCES "cost_centers"("id", "company_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "titles" ADD CONSTRAINT "titles_cost_center_company_fkey"
  FOREIGN KEY ("cost_center_id", "company_id") REFERENCES "cost_centers"("id", "company_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "recurrence_rules" ADD CONSTRAINT "recurrence_rules_cost_center_company_fkey"
  FOREIGN KEY ("cost_center_id", "company_id") REFERENCES "cost_centers"("id", "company_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "titles" ADD CONSTRAINT "titles_deleted_by_user_id_fkey"
  FOREIGN KEY ("deleted_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Relações críticas usam o company_id dos dois lados; assim um bug na
-- aplicação não consegue ligar registros de empresas diferentes.
ALTER TABLE "titles" DROP CONSTRAINT IF EXISTS "titles_category_id_fkey";
ALTER TABLE "titles" ADD CONSTRAINT "titles_category_company_fkey" FOREIGN KEY ("category_id", "company_id") REFERENCES "categories"("id", "company_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "titles" DROP CONSTRAINT IF EXISTS "titles_party_id_fkey";
ALTER TABLE "titles" ADD CONSTRAINT "titles_party_company_fkey" FOREIGN KEY ("party_id", "company_id") REFERENCES "parties"("id", "company_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "titles" DROP CONSTRAINT IF EXISTS "titles_recurrence_rule_id_fkey";
ALTER TABLE "titles" ADD CONSTRAINT "titles_recurrence_rule_company_fkey" FOREIGN KEY ("recurrence_rule_id", "company_id") REFERENCES "recurrence_rules"("id", "company_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "settlements" DROP CONSTRAINT IF EXISTS "settlements_title_id_fkey";
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_title_company_fkey" FOREIGN KEY ("title_id", "company_id") REFERENCES "titles"("id", "company_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "settlements" DROP CONSTRAINT IF EXISTS "settlements_financial_account_id_fkey";
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_account_company_fkey" FOREIGN KEY ("financial_account_id", "company_id") REFERENCES "financial_accounts"("id", "company_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "transfers" DROP CONSTRAINT IF EXISTS "transfers_from_account_id_fkey";
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_from_account_company_fkey" FOREIGN KEY ("from_account_id", "company_id") REFERENCES "financial_accounts"("id", "company_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "transfers" DROP CONSTRAINT IF EXISTS "transfers_to_account_id_fkey";
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_to_account_company_fkey" FOREIGN KEY ("to_account_id", "company_id") REFERENCES "financial_accounts"("id", "company_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attachments" DROP CONSTRAINT IF EXISTS "attachments_title_id_fkey";
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_title_company_fkey" FOREIGN KEY ("title_id", "company_id") REFERENCES "titles"("id", "company_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "balance_adjustments" DROP CONSTRAINT IF EXISTS "balance_adjustments_financial_account_id_fkey";
ALTER TABLE "balance_adjustments" ADD CONSTRAINT "balance_adjustments_account_company_fkey" FOREIGN KEY ("financial_account_id", "company_id") REFERENCES "financial_accounts"("id", "company_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "import_batches" DROP CONSTRAINT IF EXISTS "import_batches_financial_account_id_fkey";
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_account_company_fkey" FOREIGN KEY ("financial_account_id", "company_id") REFERENCES "financial_accounts"("id", "company_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "import_jobs" DROP CONSTRAINT IF EXISTS "import_jobs_import_batch_id_fkey";
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_batch_company_fkey" FOREIGN KEY ("import_batch_id", "company_id") REFERENCES "import_batches"("id", "company_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bank_statement_lines" DROP CONSTRAINT IF EXISTS "bank_statement_lines_financial_account_id_fkey";
ALTER TABLE "bank_statement_lines" ADD CONSTRAINT "bank_statement_lines_account_company_fkey" FOREIGN KEY ("financial_account_id", "company_id") REFERENCES "financial_accounts"("id", "company_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bank_statement_lines" DROP CONSTRAINT IF EXISTS "bank_statement_lines_import_batch_id_fkey";
ALTER TABLE "bank_statement_lines" ADD CONSTRAINT "bank_statement_lines_batch_company_fkey" FOREIGN KEY ("import_batch_id", "company_id") REFERENCES "import_batches"("id", "company_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bank_statement_lines" DROP CONSTRAINT IF EXISTS "bank_statement_lines_reconciled_settlement_id_fkey";
ALTER TABLE "bank_statement_lines" ADD CONSTRAINT "bank_statement_lines_settlement_company_fkey" FOREIGN KEY ("reconciled_settlement_id", "company_id") REFERENCES "settlements"("id", "company_id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION app_can_access_account(p_company_id TEXT, p_account_id TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.user_id = current_setting('app.current_user_id', true)
      AND m.company_id = p_company_id AND m.status = 'ACTIVE'
      AND (
        m.role = 'OWNER' OR m.access_scope = 'ALL'
        OR EXISTS (SELECT 1 FROM public.membership_financial_accounts a WHERE a.membership_id = m.id AND a.company_id = p_company_id AND a.financial_account_id = p_account_id)
      )
  )
$$;

CREATE OR REPLACE FUNCTION app_can_access_cost_center(p_company_id TEXT, p_cost_center_id TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.user_id = current_setting('app.current_user_id', true)
      AND m.company_id = p_company_id AND m.status = 'ACTIVE'
      AND (
        m.role = 'OWNER' OR m.access_scope = 'ALL'
        OR (p_cost_center_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.membership_cost_centers c WHERE c.membership_id = m.id AND c.company_id = p_company_id AND c.cost_center_id = p_cost_center_id))
      )
  )
$$;

CREATE OR REPLACE FUNCTION app_can_access_title(p_company_id TEXT, p_title_id TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.titles t
    WHERE t.id = p_title_id AND t.company_id = p_company_id
      AND public.app_can_access_cost_center(p_company_id, t.cost_center_id)
  )
$$;

ALTER TABLE "cost_centers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cost_centers" FORCE ROW LEVEL SECURITY;
CREATE POLICY cost_centers_all ON "cost_centers" FOR ALL
  USING ("company_id" = current_setting('app.current_company_id', true) AND app_can_access_cost_center("company_id", "id"))
  WITH CHECK ("company_id" = current_setting('app.current_company_id', true));

ALTER TABLE "membership_financial_accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "membership_financial_accounts" FORCE ROW LEVEL SECURITY;
CREATE POLICY membership_financial_accounts_owner ON "membership_financial_accounts" FOR ALL
  USING (EXISTS (SELECT 1 FROM "memberships" m WHERE m."id" = "membership_financial_accounts"."membership_id" AND m."company_id" = "membership_financial_accounts"."company_id" AND m."user_id" = current_setting('app.current_user_id', true) AND m."role" = 'OWNER' AND m."status" = 'ACTIVE'))
  WITH CHECK (EXISTS (SELECT 1 FROM "memberships" m WHERE m."company_id" = "membership_financial_accounts"."company_id" AND m."user_id" = current_setting('app.current_user_id', true) AND m."role" = 'OWNER' AND m."status" = 'ACTIVE'));

ALTER TABLE "membership_cost_centers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "membership_cost_centers" FORCE ROW LEVEL SECURITY;
CREATE POLICY membership_cost_centers_owner ON "membership_cost_centers" FOR ALL
  USING (EXISTS (SELECT 1 FROM "memberships" m WHERE m."id" = "membership_cost_centers"."membership_id" AND m."company_id" = "membership_cost_centers"."company_id" AND m."user_id" = current_setting('app.current_user_id', true) AND m."role" = 'OWNER' AND m."status" = 'ACTIVE'))
  WITH CHECK (EXISTS (SELECT 1 FROM "memberships" m WHERE m."company_id" = "membership_cost_centers"."company_id" AND m."user_id" = current_setting('app.current_user_id', true) AND m."role" = 'OWNER' AND m."status" = 'ACTIVE'));

DROP POLICY IF EXISTS financial_accounts_all ON "financial_accounts";
CREATE POLICY financial_accounts_all ON "financial_accounts" FOR ALL USING ("company_id" = current_setting('app.current_company_id', true) AND app_can_access_account("company_id", "id")) WITH CHECK ("company_id" = current_setting('app.current_company_id', true) AND app_can_access_account("company_id", "id"));
DROP POLICY IF EXISTS titles_all ON "titles";
CREATE POLICY titles_all ON "titles" FOR ALL USING ("company_id" = current_setting('app.current_company_id', true) AND app_can_access_cost_center("company_id", "cost_center_id")) WITH CHECK ("company_id" = current_setting('app.current_company_id', true) AND app_can_access_cost_center("company_id", "cost_center_id"));
DROP POLICY IF EXISTS settlements_all ON "settlements";
CREATE POLICY settlements_all ON "settlements" FOR ALL USING ("company_id" = current_setting('app.current_company_id', true) AND app_can_access_title("company_id", "title_id") AND app_can_access_account("company_id", "financial_account_id")) WITH CHECK ("company_id" = current_setting('app.current_company_id', true) AND app_can_access_title("company_id", "title_id") AND app_can_access_account("company_id", "financial_account_id"));
DROP POLICY IF EXISTS transfers_all ON "transfers";
CREATE POLICY transfers_all ON "transfers" FOR ALL USING ("company_id" = current_setting('app.current_company_id', true) AND app_can_access_account("company_id", "from_account_id") AND app_can_access_account("company_id", "to_account_id")) WITH CHECK ("company_id" = current_setting('app.current_company_id', true) AND app_can_access_account("company_id", "from_account_id") AND app_can_access_account("company_id", "to_account_id"));
DROP POLICY IF EXISTS balance_adjustments_all ON "balance_adjustments";
CREATE POLICY balance_adjustments_all ON "balance_adjustments" FOR ALL USING ("company_id" = current_setting('app.current_company_id', true) AND app_can_access_account("company_id", "financial_account_id")) WITH CHECK ("company_id" = current_setting('app.current_company_id', true) AND app_can_access_account("company_id", "financial_account_id"));
DROP POLICY IF EXISTS import_batches_all ON "import_batches";
CREATE POLICY import_batches_all ON "import_batches" FOR ALL USING ("company_id" = current_setting('app.current_company_id', true) AND app_can_access_account("company_id", "financial_account_id")) WITH CHECK ("company_id" = current_setting('app.current_company_id', true) AND app_can_access_account("company_id", "financial_account_id"));
DROP POLICY IF EXISTS bank_statement_lines_all ON "bank_statement_lines";
CREATE POLICY bank_statement_lines_all ON "bank_statement_lines" FOR ALL USING ("company_id" = current_setting('app.current_company_id', true) AND app_can_access_account("company_id", "financial_account_id")) WITH CHECK ("company_id" = current_setting('app.current_company_id', true) AND app_can_access_account("company_id", "financial_account_id"));
DROP POLICY IF EXISTS attachments_company_select ON "attachments";
CREATE POLICY attachments_company_select ON "attachments" FOR SELECT USING ("company_id" = current_setting('app.current_company_id', true) AND app_can_access_title("company_id", "title_id"));
DROP POLICY IF EXISTS attachments_company_insert ON "attachments";
CREATE POLICY attachments_company_insert ON "attachments" FOR INSERT WITH CHECK ("company_id" = current_setting('app.current_company_id', true) AND "uploaded_by_user_id" = current_setting('app.current_user_id', true) AND app_can_access_title("company_id", "title_id"));
DROP POLICY IF EXISTS attachments_company_delete ON "attachments";
CREATE POLICY attachments_company_delete ON "attachments" FOR DELETE USING ("company_id" = current_setting('app.current_company_id', true) AND app_can_access_title("company_id", "title_id"));
DROP POLICY IF EXISTS recurrence_rules_all ON "recurrence_rules";
CREATE POLICY recurrence_rules_all ON "recurrence_rules" FOR ALL USING ("company_id" = current_setting('app.current_company_id', true) AND app_can_access_cost_center("company_id", "cost_center_id")) WITH CHECK ("company_id" = current_setting('app.current_company_id', true) AND app_can_access_cost_center("company_id", "cost_center_id"));

GRANT SELECT, INSERT, UPDATE ON TABLE "cost_centers" TO ax_app;
GRANT SELECT, INSERT, DELETE ON TABLE "membership_financial_accounts" TO ax_app;
GRANT SELECT, INSERT, DELETE ON TABLE "membership_cost_centers" TO ax_app;
GRANT EXECUTE ON FUNCTION app_can_access_account(TEXT, TEXT) TO ax_app;
GRANT EXECUTE ON FUNCTION app_can_access_cost_center(TEXT, TEXT) TO ax_app;
GRANT EXECUTE ON FUNCTION app_can_access_title(TEXT, TEXT) TO ax_app;
