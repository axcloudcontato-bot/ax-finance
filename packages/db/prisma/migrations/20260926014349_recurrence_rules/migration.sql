-- CreateEnum
CREATE TYPE "RecurrenceStatus" AS ENUM ('ACTIVE', 'PAUSED', 'CANCELLED');

-- AlterTable
ALTER TABLE "titles" ADD COLUMN     "recurrence_occurrence_date" DATE,
ADD COLUMN     "recurrence_rule_id" TEXT;

-- CreateTable
CREATE TABLE "recurrence_rules" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "type" "TitleType" NOT NULL,
    "description" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "party_id" TEXT,
    "amount_cents" BIGINT NOT NULL,
    "day_of_month" INTEGER NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "status" "RecurrenceStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurrence_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recurrence_rules_company_id_idx" ON "recurrence_rules"("company_id");

-- CreateIndex
CREATE INDEX "titles_company_id_recurrence_rule_id_idx" ON "titles"("company_id", "recurrence_rule_id");

-- CreateIndex
CREATE UNIQUE INDEX "titles_recurrence_rule_id_recurrence_occurrence_date_key" ON "titles"("recurrence_rule_id", "recurrence_occurrence_date");

-- AddForeignKey
ALTER TABLE "recurrence_rules" ADD CONSTRAINT "recurrence_rules_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurrence_rules" ADD CONSTRAINT "recurrence_rules_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurrence_rules" ADD CONSTRAINT "recurrence_rules_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "titles" ADD CONSTRAINT "titles_recurrence_rule_id_fkey" FOREIGN KEY ("recurrence_rule_id") REFERENCES "recurrence_rules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Isolamento multiempresa: mesmo padrão reforçado de parties_all
-- (migration 20260926010321) — confere membership ATIVA por conta própria,
-- não só o app.current_company_id do contexto.
GRANT SELECT, INSERT, UPDATE, DELETE ON "recurrence_rules" TO ax_app;

ALTER TABLE "recurrence_rules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "recurrence_rules" FORCE ROW LEVEL SECURITY;

CREATE POLICY recurrence_rules_all ON "recurrence_rules"
  FOR ALL
  USING (
    "company_id" = current_setting('app.current_company_id', true)
    AND EXISTS (
      SELECT 1 FROM "memberships" m
      WHERE m."company_id" = "recurrence_rules"."company_id"
        AND m."user_id" = current_setting('app.current_user_id', true)
        AND m."status" = 'ACTIVE'
    )
  )
  WITH CHECK (
    "company_id" = current_setting('app.current_company_id', true)
    AND EXISTS (
      SELECT 1 FROM "memberships" m
      WHERE m."company_id" = "recurrence_rules"."company_id"
        AND m."user_id" = current_setting('app.current_user_id', true)
        AND m."status" = 'ACTIVE'
    )
  );
