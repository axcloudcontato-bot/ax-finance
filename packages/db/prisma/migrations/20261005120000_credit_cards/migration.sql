-- Cartão de crédito: cartão, fatura (ciclo) e compras.
-- A fatura aponta para um título PAYABLE (title_id) que carrega o valor a pagar; pagar a fatura
-- é uma baixa comum desse título. As compras guardam categoria/competência para o DRE.

CREATE TYPE "CreditCardBrand" AS ENUM ('VISA', 'MASTERCARD', 'ELO', 'AMEX', 'HIPERCARD', 'OTHER');
CREATE TYPE "CreditCardStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

CREATE TABLE "credit_cards" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" "CreditCardBrand" NOT NULL DEFAULT 'OTHER',
    "last_digits" TEXT,
    "limit_cents" BIGINT NOT NULL,
    "closing_day" INTEGER NOT NULL,
    "due_day" INTEGER NOT NULL,
    "default_payment_account_id" TEXT,
    "status" "CreditCardStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_cards_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "credit_cards_limit_positive" CHECK ("limit_cents" > 0),
    CONSTRAINT "credit_cards_closing_day_range" CHECK ("closing_day" BETWEEN 1 AND 31),
    CONSTRAINT "credit_cards_due_day_range" CHECK ("due_day" BETWEEN 1 AND 31),
    CONSTRAINT "credit_cards_last_digits_format" CHECK ("last_digits" IS NULL OR "last_digits" ~ '^[0-9]{4}$')
);

CREATE TABLE "credit_card_invoices" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "card_id" TEXT NOT NULL,
    "reference_month" TEXT NOT NULL,
    "closing_date" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "title_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_card_invoices_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "credit_card_invoices_reference_month_format" CHECK ("reference_month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
    CONSTRAINT "credit_card_invoices_due_after_closing" CHECK ("due_date" > "closing_date")
);

CREATE TABLE "credit_card_purchases" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "card_id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "cost_center_id" TEXT,
    "party_id" TEXT,
    "amount_cents" BIGINT NOT NULL,
    "purchase_date" DATE NOT NULL,
    "competence_date" DATE NOT NULL,
    "installment_group_id" TEXT,
    "installment_number" INTEGER,
    "installment_count" INTEGER,
    "notes" TEXT,
    "canceled_at" TIMESTAMP(3),
    "cancel_reason" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_card_purchases_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "credit_card_purchases_amount_positive" CHECK ("amount_cents" > 0),
    CONSTRAINT "credit_card_purchases_installment_consistent" CHECK (
        ("installment_group_id" IS NULL AND "installment_number" IS NULL AND "installment_count" IS NULL)
        OR ("installment_group_id" IS NOT NULL AND "installment_number" BETWEEN 1 AND "installment_count" AND "installment_count" >= 2)
    )
);

CREATE INDEX "credit_cards_company_id_status_idx" ON "credit_cards"("company_id", "status");
CREATE UNIQUE INDEX "credit_cards_id_company_id_key" ON "credit_cards"("id", "company_id");

CREATE UNIQUE INDEX "credit_card_invoices_title_id_key" ON "credit_card_invoices"("title_id");
CREATE INDEX "credit_card_invoices_company_id_card_id_idx" ON "credit_card_invoices"("company_id", "card_id");
CREATE INDEX "credit_card_invoices_company_id_due_date_idx" ON "credit_card_invoices"("company_id", "due_date");
CREATE UNIQUE INDEX "credit_card_invoices_id_company_id_key" ON "credit_card_invoices"("id", "company_id");
CREATE UNIQUE INDEX "credit_card_invoices_card_id_reference_month_key" ON "credit_card_invoices"("card_id", "reference_month");

CREATE INDEX "credit_card_purchases_company_id_card_id_idx" ON "credit_card_purchases"("company_id", "card_id");
CREATE INDEX "credit_card_purchases_company_id_invoice_id_idx" ON "credit_card_purchases"("company_id", "invoice_id");
CREATE INDEX "credit_card_purchases_company_id_competence_date_idx" ON "credit_card_purchases"("company_id", "competence_date");
CREATE INDEX "credit_card_purchases_company_id_installment_group_id_idx" ON "credit_card_purchases"("company_id", "installment_group_id");
CREATE UNIQUE INDEX "credit_card_purchases_id_company_id_key" ON "credit_card_purchases"("id", "company_id");

-- Chaves estrangeiras compostas (id, company_id): um registro nunca aponta para outra empresa.
ALTER TABLE "credit_cards" ADD CONSTRAINT "credit_cards_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "credit_cards" ADD CONSTRAINT "credit_cards_default_payment_account_id_company_id_fkey"
  FOREIGN KEY ("default_payment_account_id", "company_id") REFERENCES "financial_accounts"("id", "company_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "credit_card_invoices" ADD CONSTRAINT "credit_card_invoices_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "credit_card_invoices" ADD CONSTRAINT "credit_card_invoices_card_id_company_id_fkey"
  FOREIGN KEY ("card_id", "company_id") REFERENCES "credit_cards"("id", "company_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "credit_card_invoices" ADD CONSTRAINT "credit_card_invoices_title_id_fkey"
  FOREIGN KEY ("title_id") REFERENCES "titles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "credit_card_purchases" ADD CONSTRAINT "credit_card_purchases_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "credit_card_purchases" ADD CONSTRAINT "credit_card_purchases_card_id_company_id_fkey"
  FOREIGN KEY ("card_id", "company_id") REFERENCES "credit_cards"("id", "company_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "credit_card_purchases" ADD CONSTRAINT "credit_card_purchases_invoice_id_company_id_fkey"
  FOREIGN KEY ("invoice_id", "company_id") REFERENCES "credit_card_invoices"("id", "company_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "credit_card_purchases" ADD CONSTRAINT "credit_card_purchases_category_id_company_id_fkey"
  FOREIGN KEY ("category_id", "company_id") REFERENCES "categories"("id", "company_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "credit_card_purchases" ADD CONSTRAINT "credit_card_purchases_cost_center_id_company_id_fkey"
  FOREIGN KEY ("cost_center_id", "company_id") REFERENCES "cost_centers"("id", "company_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "credit_card_purchases" ADD CONSTRAINT "credit_card_purchases_party_id_company_id_fkey"
  FOREIGN KEY ("party_id", "company_id") REFERENCES "parties"("id", "company_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Isolamento multiempresa (RLS forçada). A fatura agrega compras de vários centros de custo e
-- o título dela não tem centro, então só proprietário ou acesso total ("ALL") enxerga cartão:
-- `app_can_access_cost_center(company, NULL)` é verdadeira só nesses dois casos.
GRANT SELECT, INSERT, UPDATE, DELETE ON "credit_cards", "credit_card_invoices", "credit_card_purchases" TO ax_app;

ALTER TABLE "credit_cards" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "credit_cards" FORCE ROW LEVEL SECURITY;
CREATE POLICY credit_cards_all ON "credit_cards" FOR ALL
  USING ("company_id" = current_setting('app.current_company_id', true) AND app_can_access_cost_center("company_id", NULL))
  WITH CHECK ("company_id" = current_setting('app.current_company_id', true) AND app_can_access_cost_center("company_id", NULL));

ALTER TABLE "credit_card_invoices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "credit_card_invoices" FORCE ROW LEVEL SECURITY;
CREATE POLICY credit_card_invoices_all ON "credit_card_invoices" FOR ALL
  USING ("company_id" = current_setting('app.current_company_id', true) AND app_can_access_cost_center("company_id", NULL))
  WITH CHECK ("company_id" = current_setting('app.current_company_id', true) AND app_can_access_cost_center("company_id", NULL));

ALTER TABLE "credit_card_purchases" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "credit_card_purchases" FORCE ROW LEVEL SECURITY;
CREATE POLICY credit_card_purchases_all ON "credit_card_purchases" FOR ALL
  USING ("company_id" = current_setting('app.current_company_id', true) AND app_can_access_cost_center("company_id", NULL))
  WITH CHECK ("company_id" = current_setting('app.current_company_id', true) AND app_can_access_cost_center("company_id", NULL));
