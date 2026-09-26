-- CreateTable
CREATE TABLE "balance_adjustments" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "financial_account_id" TEXT NOT NULL,
    "amount_cents" BIGINT NOT NULL,
    "reason" TEXT NOT NULL,
    "effective_date" DATE NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "reversed_at" TIMESTAMP(3),
    "reversal_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "balance_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "balance_adjustments_company_id_idx" ON "balance_adjustments"("company_id");

-- CreateIndex
CREATE INDEX "balance_adjustments_financial_account_id_idx" ON "balance_adjustments"("financial_account_id");

-- AddForeignKey
ALTER TABLE "balance_adjustments" ADD CONSTRAINT "balance_adjustments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "balance_adjustments" ADD CONSTRAINT "balance_adjustments_financial_account_id_fkey" FOREIGN KEY ("financial_account_id") REFERENCES "financial_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Isolamento multiempresa: mesmo padrão reforçado já usado em titles/settlements/
-- transfers — confere membership ATIVA por conta própria, não só o
-- app.current_company_id do contexto. DELETE incluso pra simetria com as
-- outras tabelas de movimento (settlements/transfers/titles).
GRANT SELECT, INSERT, UPDATE, DELETE ON "balance_adjustments" TO ax_app;

ALTER TABLE "balance_adjustments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "balance_adjustments" FORCE ROW LEVEL SECURITY;

CREATE POLICY balance_adjustments_all ON "balance_adjustments"
  FOR ALL
  USING (
    "company_id" = current_setting('app.current_company_id', true)
    AND EXISTS (
      SELECT 1 FROM "memberships" m
      WHERE m."company_id" = "balance_adjustments"."company_id"
        AND m."user_id" = current_setting('app.current_user_id', true)
        AND m."status" = 'ACTIVE'
    )
  )
  WITH CHECK (
    "company_id" = current_setting('app.current_company_id', true)
    AND EXISTS (
      SELECT 1 FROM "memberships" m
      WHERE m."company_id" = "balance_adjustments"."company_id"
        AND m."user_id" = current_setting('app.current_user_id', true)
        AND m."status" = 'ACTIVE'
    )
  );
