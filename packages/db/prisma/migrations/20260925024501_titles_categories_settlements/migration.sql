-- CreateEnum
CREATE TYPE "CategoryNature" AS ENUM ('OPERATING_REVENUE', 'COST', 'EXPENSE', 'INVESTMENT', 'FINANCING', 'EQUITY', 'TECHNICAL_TRANSFER');

-- CreateEnum
CREATE TYPE "CategoryStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TitleType" AS ENUM ('RECEIVABLE', 'PAYABLE');

-- CreateEnum
CREATE TYPE "TitleStatus" AS ENUM ('OPEN', 'PARTIALLY_SETTLED', 'SETTLED', 'CANCELLED');

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "name" TEXT NOT NULL,
    "nature" "CategoryNature" NOT NULL,
    "managerial_group" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "color" TEXT,
    "status" "CategoryStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "titles" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "type" "TitleType" NOT NULL,
    "description" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "original_amount_cents" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "competence_date" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "status" "TitleStatus" NOT NULL DEFAULT 'OPEN',
    "cancel_reason" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "titles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlements" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "title_id" TEXT NOT NULL,
    "financial_account_id" TEXT NOT NULL,
    "principal_amount_cents" BIGINT NOT NULL,
    "discount_cents" BIGINT NOT NULL DEFAULT 0,
    "interest_penalty_cents" BIGINT NOT NULL DEFAULT 0,
    "fees_cents" BIGINT NOT NULL DEFAULT 0,
    "effective_date" DATE NOT NULL,
    "payment_method" TEXT,
    "notes" TEXT,
    "reversed_at" TIMESTAMP(3),
    "reversal_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "settlements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "categories_company_id_idx" ON "categories"("company_id");

-- CreateIndex
CREATE INDEX "categories_parent_id_idx" ON "categories"("parent_id");

-- CreateIndex
CREATE INDEX "titles_company_id_idx" ON "titles"("company_id");

-- CreateIndex
CREATE INDEX "titles_company_id_due_date_idx" ON "titles"("company_id", "due_date");

-- CreateIndex
CREATE INDEX "titles_category_id_idx" ON "titles"("category_id");

-- CreateIndex
CREATE INDEX "settlements_company_id_idx" ON "settlements"("company_id");

-- CreateIndex
CREATE INDEX "settlements_title_id_idx" ON "settlements"("title_id");

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "titles" ADD CONSTRAINT "titles_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "titles" ADD CONSTRAINT "titles_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_title_id_fkey" FOREIGN KEY ("title_id") REFERENCES "titles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_financial_account_id_fkey" FOREIGN KEY ("financial_account_id") REFERENCES "financial_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Isolamento multiempresa: mesmo padrão reforçado de financial_accounts_all
-- (migration 20260925015200) — a política confere membership ATIVA por conta
-- própria, não só o app.current_company_id do contexto. `ax_app` já recebeu
-- GRANT nestas tabelas via ALTER DEFAULT PRIVILEGES daquela migration, mas o
-- GRANT explícito abaixo documenta a intenção e não depende de ordem.
GRANT SELECT, INSERT, UPDATE, DELETE ON "categories", "titles", "settlements" TO ax_app;

ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "categories" FORCE ROW LEVEL SECURITY;

CREATE POLICY categories_all ON "categories"
  FOR ALL
  USING (
    "company_id" = current_setting('app.current_company_id', true)
    AND EXISTS (
      SELECT 1 FROM "memberships" m
      WHERE m."company_id" = "categories"."company_id"
        AND m."user_id" = current_setting('app.current_user_id', true)
        AND m."status" = 'ACTIVE'
    )
  )
  WITH CHECK (
    "company_id" = current_setting('app.current_company_id', true)
    AND EXISTS (
      SELECT 1 FROM "memberships" m
      WHERE m."company_id" = "categories"."company_id"
        AND m."user_id" = current_setting('app.current_user_id', true)
        AND m."status" = 'ACTIVE'
    )
  );

ALTER TABLE "titles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "titles" FORCE ROW LEVEL SECURITY;

CREATE POLICY titles_all ON "titles"
  FOR ALL
  USING (
    "company_id" = current_setting('app.current_company_id', true)
    AND EXISTS (
      SELECT 1 FROM "memberships" m
      WHERE m."company_id" = "titles"."company_id"
        AND m."user_id" = current_setting('app.current_user_id', true)
        AND m."status" = 'ACTIVE'
    )
  )
  WITH CHECK (
    "company_id" = current_setting('app.current_company_id', true)
    AND EXISTS (
      SELECT 1 FROM "memberships" m
      WHERE m."company_id" = "titles"."company_id"
        AND m."user_id" = current_setting('app.current_user_id', true)
        AND m."status" = 'ACTIVE'
    )
  );

ALTER TABLE "settlements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "settlements" FORCE ROW LEVEL SECURITY;

CREATE POLICY settlements_all ON "settlements"
  FOR ALL
  USING (
    "company_id" = current_setting('app.current_company_id', true)
    AND EXISTS (
      SELECT 1 FROM "memberships" m
      WHERE m."company_id" = "settlements"."company_id"
        AND m."user_id" = current_setting('app.current_user_id', true)
        AND m."status" = 'ACTIVE'
    )
  )
  WITH CHECK (
    "company_id" = current_setting('app.current_company_id', true)
    AND EXISTS (
      SELECT 1 FROM "memberships" m
      WHERE m."company_id" = "settlements"."company_id"
        AND m."user_id" = current_setting('app.current_user_id', true)
        AND m."status" = 'ACTIVE'
    )
  );
