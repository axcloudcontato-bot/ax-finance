-- Dívidas e financiamentos (parcelas geradas como saídas, saldo devedor pela tabela Price/SAC) e bens
-- e investimentos (valor informado pela pessoa), para a visão de patrimônio.
CREATE TYPE "DebtKind" AS ENUM ('FINANCING', 'LOAN', 'OVERDRAFT', 'OTHER');
CREATE TYPE "AmortizationSystem" AS ENUM ('PRICE', 'SAC');
CREATE TYPE "DebtStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "AssetKind" AS ENUM ('INVESTMENT', 'PROPERTY', 'VEHICLE', 'OTHER');

CREATE TABLE "debts" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "DebtKind" NOT NULL DEFAULT 'FINANCING',
    "lender" TEXT,
    "principal_cents" BIGINT NOT NULL,
    "monthly_rate_bps" INTEGER NOT NULL,
    "installment_count" INTEGER NOT NULL,
    "paid_before_count" INTEGER NOT NULL DEFAULT 0,
    "first_due_date" DATE NOT NULL,
    "amortization" "AmortizationSystem" NOT NULL DEFAULT 'PRICE',
    "installment_group_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "expected_account_id" TEXT,
    "status" "DebtStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "debts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "debts_principal_positive" CHECK ("principal_cents" > 0),
    CONSTRAINT "debts_rate_range" CHECK ("monthly_rate_bps" >= 0 AND "monthly_rate_bps" <= 2000),
    CONSTRAINT "debts_installments_range" CHECK ("installment_count" BETWEEN 1 AND 600 AND "paid_before_count" >= 0 AND "paid_before_count" < "installment_count")
);
CREATE UNIQUE INDEX "debts_installment_group_id_key" ON "debts"("installment_group_id");
CREATE INDEX "debts_company_id_status_idx" ON "debts"("company_id", "status");
ALTER TABLE "debts" ADD CONSTRAINT "debts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "debts" ADD CONSTRAINT "debts_category_id_company_id_fkey" FOREIGN KEY ("category_id", "company_id") REFERENCES "categories"("id", "company_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "debts" ADD CONSTRAINT "debts_expected_account_id_fkey" FOREIGN KEY ("expected_account_id") REFERENCES "financial_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "AssetKind" NOT NULL DEFAULT 'INVESTMENT',
    "value_cents" BIGINT NOT NULL,
    "valued_at" DATE NOT NULL,
    "notes" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "assets_value_not_negative" CHECK ("value_cents" >= 0)
);
CREATE INDEX "assets_company_id_idx" ON "assets"("company_id");
ALTER TABLE "assets" ADD CONSTRAINT "assets_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Mesmo padrão reforçado das demais tabelas de dados: confere a membership ATIVA por conta própria.
GRANT SELECT, INSERT, UPDATE, DELETE ON "debts" TO ax_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "assets" TO ax_app;

ALTER TABLE "debts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "debts" FORCE ROW LEVEL SECURITY;
CREATE POLICY debts_all ON "debts"
  FOR ALL
  USING (
    "company_id" = current_setting('app.current_company_id', true)
    AND EXISTS (SELECT 1 FROM "memberships" m WHERE m."company_id" = "debts"."company_id" AND m."user_id" = current_setting('app.current_user_id', true) AND m."status" = 'ACTIVE')
  )
  WITH CHECK (
    "company_id" = current_setting('app.current_company_id', true)
    AND EXISTS (SELECT 1 FROM "memberships" m WHERE m."company_id" = "debts"."company_id" AND m."user_id" = current_setting('app.current_user_id', true) AND m."status" = 'ACTIVE')
  );

ALTER TABLE "assets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "assets" FORCE ROW LEVEL SECURITY;
CREATE POLICY assets_all ON "assets"
  FOR ALL
  USING (
    "company_id" = current_setting('app.current_company_id', true)
    AND EXISTS (SELECT 1 FROM "memberships" m WHERE m."company_id" = "assets"."company_id" AND m."user_id" = current_setting('app.current_user_id', true) AND m."status" = 'ACTIVE')
  )
  WITH CHECK (
    "company_id" = current_setting('app.current_company_id', true)
    AND EXISTS (SELECT 1 FROM "memberships" m WHERE m."company_id" = "assets"."company_id" AND m."user_id" = current_setting('app.current_user_id', true) AND m."status" = 'ACTIVE')
  );
