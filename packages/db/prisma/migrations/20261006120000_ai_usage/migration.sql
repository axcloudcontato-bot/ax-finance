-- Consumo mensal das sugestões por IA: um contador por empresa e mês, para limitar o custo por plano.
CREATE TABLE "ai_usage" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "requests" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_usage_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ai_usage_requests_non_negative" CHECK ("requests" >= 0),
    CONSTRAINT "ai_usage_period_format" CHECK ("period" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
);

CREATE UNIQUE INDEX "ai_usage_company_id_period_key" ON "ai_usage"("company_id", "period");

ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

GRANT SELECT, INSERT, UPDATE ON "ai_usage" TO ax_app;

ALTER TABLE "ai_usage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_usage" FORCE ROW LEVEL SECURITY;

CREATE POLICY ai_usage_all ON "ai_usage"
  FOR ALL
  USING (
    "company_id" = current_setting('app.current_company_id', true)
    AND EXISTS (
      SELECT 1 FROM "memberships" m
      WHERE m."company_id" = "ai_usage"."company_id"
        AND m."user_id" = current_setting('app.current_user_id', true)
        AND m."status" = 'ACTIVE'
    )
  )
  WITH CHECK (
    "company_id" = current_setting('app.current_company_id', true)
    AND EXISTS (
      SELECT 1 FROM "memberships" m
      WHERE m."company_id" = "ai_usage"."company_id"
        AND m."user_id" = current_setting('app.current_user_id', true)
        AND m."status" = 'ACTIVE'
    )
  );
