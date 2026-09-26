-- CreateEnum
CREATE TYPE "BankStatementLineStatus" AS ENUM ('PENDING', 'RECONCILED', 'IGNORED');

-- CreateTable
CREATE TABLE "import_batches" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "financial_account_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "row_count" INTEGER NOT NULL,
    "imported_count" INTEGER NOT NULL,
    "duplicate_count" INTEGER NOT NULL,
    "invalid_count" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_statement_lines" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "financial_account_id" TEXT NOT NULL,
    "import_batch_id" TEXT NOT NULL,
    "line_date" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "amount_cents" BIGINT NOT NULL,
    "dedup_key" TEXT NOT NULL,
    "status" "BankStatementLineStatus" NOT NULL DEFAULT 'PENDING',
    "reconciled_settlement_id" TEXT,
    "ignore_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_statement_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "import_batches_company_id_idx" ON "import_batches"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "bank_statement_lines_reconciled_settlement_id_key" ON "bank_statement_lines"("reconciled_settlement_id");

-- CreateIndex
CREATE INDEX "bank_statement_lines_company_id_idx" ON "bank_statement_lines"("company_id");

-- CreateIndex
CREATE INDEX "bank_statement_lines_financial_account_id_idx" ON "bank_statement_lines"("financial_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "bank_statement_lines_company_id_financial_account_id_dedup__key" ON "bank_statement_lines"("company_id", "financial_account_id", "dedup_key");

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_financial_account_id_fkey" FOREIGN KEY ("financial_account_id") REFERENCES "financial_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_statement_lines" ADD CONSTRAINT "bank_statement_lines_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_statement_lines" ADD CONSTRAINT "bank_statement_lines_financial_account_id_fkey" FOREIGN KEY ("financial_account_id") REFERENCES "financial_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_statement_lines" ADD CONSTRAINT "bank_statement_lines_import_batch_id_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "import_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_statement_lines" ADD CONSTRAINT "bank_statement_lines_reconciled_settlement_id_fkey" FOREIGN KEY ("reconciled_settlement_id") REFERENCES "settlements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Isolamento multiempresa: mesmo padrão reforçado de recurrence_rules_all
-- (migration 20260926014349) — confere membership ATIVA por conta própria,
-- não só o app.current_company_id do contexto.
GRANT SELECT, INSERT, UPDATE, DELETE ON "import_batches" TO ax_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "bank_statement_lines" TO ax_app;

ALTER TABLE "import_batches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "import_batches" FORCE ROW LEVEL SECURITY;

CREATE POLICY import_batches_all ON "import_batches"
  FOR ALL
  USING (
    "company_id" = current_setting('app.current_company_id', true)
    AND EXISTS (
      SELECT 1 FROM "memberships" m
      WHERE m."company_id" = "import_batches"."company_id"
        AND m."user_id" = current_setting('app.current_user_id', true)
        AND m."status" = 'ACTIVE'
    )
  )
  WITH CHECK (
    "company_id" = current_setting('app.current_company_id', true)
    AND EXISTS (
      SELECT 1 FROM "memberships" m
      WHERE m."company_id" = "import_batches"."company_id"
        AND m."user_id" = current_setting('app.current_user_id', true)
        AND m."status" = 'ACTIVE'
    )
  );

ALTER TABLE "bank_statement_lines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bank_statement_lines" FORCE ROW LEVEL SECURITY;

CREATE POLICY bank_statement_lines_all ON "bank_statement_lines"
  FOR ALL
  USING (
    "company_id" = current_setting('app.current_company_id', true)
    AND EXISTS (
      SELECT 1 FROM "memberships" m
      WHERE m."company_id" = "bank_statement_lines"."company_id"
        AND m."user_id" = current_setting('app.current_user_id', true)
        AND m."status" = 'ACTIVE'
    )
  )
  WITH CHECK (
    "company_id" = current_setting('app.current_company_id', true)
    AND EXISTS (
      SELECT 1 FROM "memberships" m
      WHERE m."company_id" = "bank_statement_lines"."company_id"
        AND m."user_id" = current_setting('app.current_user_id', true)
        AND m."status" = 'ACTIVE'
    )
  );
