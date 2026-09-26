-- CreateTable
CREATE TABLE "transfers" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "from_account_id" TEXT NOT NULL,
    "to_account_id" TEXT NOT NULL,
    "amount_cents" BIGINT NOT NULL,
    "fee_cents" BIGINT NOT NULL DEFAULT 0,
    "transfer_date" DATE NOT NULL,
    "description" TEXT,
    "reversed_at" TIMESTAMP(3),
    "reversal_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transfers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "transfers_company_id_idx" ON "transfers"("company_id");

-- CreateIndex
CREATE INDEX "transfers_from_account_id_idx" ON "transfers"("from_account_id");

-- CreateIndex
CREATE INDEX "transfers_to_account_id_idx" ON "transfers"("to_account_id");

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_from_account_id_fkey" FOREIGN KEY ("from_account_id") REFERENCES "financial_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_to_account_id_fkey" FOREIGN KEY ("to_account_id") REFERENCES "financial_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Isolamento multiempresa: mesmo padrão reforçado de financial_accounts_all
-- (migration 20260925015200) — confere membership ATIVA por conta própria,
-- não só o app.current_company_id do contexto.
GRANT SELECT, INSERT, UPDATE, DELETE ON "transfers" TO ax_app;

ALTER TABLE "transfers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "transfers" FORCE ROW LEVEL SECURITY;

CREATE POLICY transfers_all ON "transfers"
  FOR ALL
  USING (
    "company_id" = current_setting('app.current_company_id', true)
    AND EXISTS (
      SELECT 1 FROM "memberships" m
      WHERE m."company_id" = "transfers"."company_id"
        AND m."user_id" = current_setting('app.current_user_id', true)
        AND m."status" = 'ACTIVE'
    )
  )
  WITH CHECK (
    "company_id" = current_setting('app.current_company_id', true)
    AND EXISTS (
      SELECT 1 FROM "memberships" m
      WHERE m."company_id" = "transfers"."company_id"
        AND m."user_id" = current_setting('app.current_user_id', true)
        AND m."status" = 'ACTIVE'
    )
  );
