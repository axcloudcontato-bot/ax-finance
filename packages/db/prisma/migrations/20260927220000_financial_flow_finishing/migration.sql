CREATE TABLE "settlement_refunds" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "settlement_id" TEXT NOT NULL,
  "financial_account_id" TEXT NOT NULL,
  "amount_cents" BIGINT NOT NULL,
  "effective_date" DATE NOT NULL,
  "reason" TEXT NOT NULL,
  "created_by_user_id" TEXT NOT NULL,
  "reversed_at" TIMESTAMP(3),
  "reversal_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "settlement_refunds_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "settlement_refunds_amount_positive" CHECK ("amount_cents" > 0)
);

CREATE TABLE "title_allocations" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "title_id" TEXT NOT NULL,
  "category_id" TEXT NOT NULL,
  "cost_center_id" TEXT,
  "amount_cents" BIGINT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "title_allocations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "title_allocations_amount_positive" CHECK ("amount_cents" > 0)
);

CREATE UNIQUE INDEX "settlement_refunds_id_company_id_key" ON "settlement_refunds"("id", "company_id");
CREATE INDEX "settlement_refunds_company_id_idx" ON "settlement_refunds"("company_id");
CREATE INDEX "settlement_refunds_settlement_id_idx" ON "settlement_refunds"("settlement_id");
CREATE INDEX "settlement_refunds_financial_account_id_idx" ON "settlement_refunds"("financial_account_id");
CREATE UNIQUE INDEX "title_allocations_id_company_id_key" ON "title_allocations"("id", "company_id");
CREATE INDEX "title_allocations_company_id_title_id_idx" ON "title_allocations"("company_id", "title_id");
CREATE INDEX "title_allocations_category_id_idx" ON "title_allocations"("category_id");
CREATE INDEX "title_allocations_cost_center_id_idx" ON "title_allocations"("cost_center_id");

ALTER TABLE "settlement_refunds" ADD CONSTRAINT "settlement_refunds_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "settlement_refunds" ADD CONSTRAINT "settlement_refunds_settlement_company_fkey"
  FOREIGN KEY ("settlement_id", "company_id") REFERENCES "settlements"("id", "company_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "settlement_refunds" ADD CONSTRAINT "settlement_refunds_account_company_fkey"
  FOREIGN KEY ("financial_account_id", "company_id") REFERENCES "financial_accounts"("id", "company_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "title_allocations" ADD CONSTRAINT "title_allocations_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "title_allocations" ADD CONSTRAINT "title_allocations_title_company_fkey"
  FOREIGN KEY ("title_id", "company_id") REFERENCES "titles"("id", "company_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "title_allocations" ADD CONSTRAINT "title_allocations_category_company_fkey"
  FOREIGN KEY ("category_id", "company_id") REFERENCES "categories"("id", "company_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "title_allocations" ADD CONSTRAINT "title_allocations_cost_center_company_fkey"
  FOREIGN KEY ("cost_center_id", "company_id") REFERENCES "cost_centers"("id", "company_id") ON DELETE RESTRICT ON UPDATE CASCADE;

GRANT SELECT, INSERT, UPDATE, DELETE ON "settlement_refunds", "title_allocations" TO ax_app;

ALTER TABLE "settlement_refunds" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "settlement_refunds" FORCE ROW LEVEL SECURITY;
CREATE POLICY settlement_refunds_all ON "settlement_refunds" FOR ALL
  USING (
    "company_id" = current_setting('app.current_company_id', true)
    AND app_can_access_title("company_id", (SELECT s."title_id" FROM "settlements" s WHERE s."id" = "settlement_refunds"."settlement_id" AND s."company_id" = "settlement_refunds"."company_id"))
    AND app_can_access_account("company_id", "financial_account_id")
  )
  WITH CHECK (
    "company_id" = current_setting('app.current_company_id', true)
    AND app_can_access_title("company_id", (SELECT s."title_id" FROM "settlements" s WHERE s."id" = "settlement_refunds"."settlement_id" AND s."company_id" = "settlement_refunds"."company_id"))
    AND app_can_access_account("company_id", "financial_account_id")
  );

ALTER TABLE "title_allocations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "title_allocations" FORCE ROW LEVEL SECURITY;
CREATE POLICY title_allocations_all ON "title_allocations" FOR ALL
  USING (
    "company_id" = current_setting('app.current_company_id', true)
    AND app_can_access_title("company_id", "title_id")
    AND app_can_access_cost_center("company_id", "cost_center_id")
  )
  WITH CHECK (
    "company_id" = current_setting('app.current_company_id', true)
    AND app_can_access_title("company_id", "title_id")
    AND app_can_access_cost_center("company_id", "cost_center_id")
  );
