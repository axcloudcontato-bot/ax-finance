-- Orçamento por categoria e mês. Parâmetro do usuário: nunca bloqueia pagamento.
CREATE TABLE "budgets" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "amount_cents" BIGINT NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "budgets_amount_positive" CHECK ("amount_cents" > 0),
    CONSTRAINT "budgets_period_format" CHECK ("period" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
);

CREATE UNIQUE INDEX "budgets_company_id_category_id_period_key" ON "budgets"("company_id", "category_id", "period");
CREATE INDEX "budgets_company_id_period_idx" ON "budgets"("company_id", "period");

ALTER TABLE "budgets" ADD CONSTRAINT "budgets_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_category_id_company_id_fkey"
  FOREIGN KEY ("category_id", "company_id") REFERENCES "categories"("id", "company_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Mesmo padrão reforçado das demais tabelas de dados: confere a membership ATIVA por conta própria.
GRANT SELECT, INSERT, UPDATE, DELETE ON "budgets" TO ax_app;

ALTER TABLE "budgets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "budgets" FORCE ROW LEVEL SECURITY;

CREATE POLICY budgets_all ON "budgets"
  FOR ALL
  USING (
    "company_id" = current_setting('app.current_company_id', true)
    AND EXISTS (
      SELECT 1 FROM "memberships" m
      WHERE m."company_id" = "budgets"."company_id"
        AND m."user_id" = current_setting('app.current_user_id', true)
        AND m."status" = 'ACTIVE'
    )
  )
  WITH CHECK (
    "company_id" = current_setting('app.current_company_id', true)
    AND EXISTS (
      SELECT 1 FROM "memberships" m
      WHERE m."company_id" = "budgets"."company_id"
        AND m."user_id" = current_setting('app.current_user_id', true)
        AND m."status" = 'ACTIVE'
    )
  );
