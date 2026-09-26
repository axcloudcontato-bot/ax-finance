-- CreateEnum
CREATE TYPE "PeriodClosureStatus" AS ENUM ('CLOSED', 'REOPENED');

-- CreateTable
CREATE TABLE "period_closures" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "status" "PeriodClosureStatus" NOT NULL DEFAULT 'CLOSED',
    "closed_by_user_id" TEXT NOT NULL,
    "closed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reopened_by_user_id" TEXT,
    "reopened_at" TIMESTAMP(3),
    "reopen_reason" TEXT,

    CONSTRAINT "period_closures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "period_closures_company_id_period_key" ON "period_closures"("company_id", "period");

-- AddForeignKey
ALTER TABLE "period_closures" ADD CONSTRAINT "period_closures_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Isolamento multiempresa: mesmo padrão reforçado de audit_events_all
-- (migration 20260926063418) — confere membership ATIVA por conta própria,
-- não só o app.current_company_id do contexto.
GRANT SELECT, INSERT, UPDATE ON "period_closures" TO ax_app;

ALTER TABLE "period_closures" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "period_closures" FORCE ROW LEVEL SECURITY;

CREATE POLICY period_closures_all ON "period_closures"
  FOR ALL
  USING (
    "company_id" = current_setting('app.current_company_id', true)
    AND EXISTS (
      SELECT 1 FROM "memberships" m
      WHERE m."company_id" = "period_closures"."company_id"
        AND m."user_id" = current_setting('app.current_user_id', true)
        AND m."status" = 'ACTIVE'
    )
  )
  WITH CHECK (
    "company_id" = current_setting('app.current_company_id', true)
    AND EXISTS (
      SELECT 1 FROM "memberships" m
      WHERE m."company_id" = "period_closures"."company_id"
        AND m."user_id" = current_setting('app.current_user_id', true)
        AND m."status" = 'ACTIVE'
    )
  );
