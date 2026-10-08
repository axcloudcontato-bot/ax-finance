-- Dados operacionais do lançamento (conta prevista, documento, forma e dados de pagamento,
-- agendamento no banco, cobrança) e multa/juros de atraso da empresa.
ALTER TABLE "titles"
  ADD COLUMN "expected_account_id" TEXT,
  ADD COLUMN "document_number" TEXT,
  ADD COLUMN "expected_payment_method" TEXT,
  ADD COLUMN "payment_code" TEXT,
  ADD COLUMN "scheduled_payment_date" DATE,
  ADD COLUMN "last_collection_at" TIMESTAMP(3),
  ADD COLUMN "collection_count" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "titles" ADD CONSTRAINT "titles_expected_account_company_fkey"
  FOREIGN KEY ("expected_account_id", "company_id") REFERENCES "financial_accounts"("id", "company_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "titles" ADD CONSTRAINT "titles_collection_count_check" CHECK ("collection_count" >= 0);
CREATE INDEX "titles_company_id_expected_account_id_idx" ON "titles"("company_id", "expected_account_id");
CREATE INDEX "titles_company_id_document_number_idx" ON "titles"("company_id", "document_number");

-- Multa (uma vez) e juros ao mês, em pontos-base (200 = 2%). Só sugerem valores na baixa de recebíveis atrasados.
ALTER TABLE "companies"
  ADD COLUMN "late_fee_bps" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "late_interest_monthly_bps" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "companies" ADD CONSTRAINT "companies_late_fee_range_check" CHECK ("late_fee_bps" BETWEEN 0 AND 2000 AND "late_interest_monthly_bps" BETWEEN 0 AND 2000);
