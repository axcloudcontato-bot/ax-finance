-- Cofrinhos: cada cofrinho tem uma conta interna própria (tipo SAVINGS_GOAL, fora do saldo disponível).
-- Guardar e resgatar são transferências entre a conta do cliente e essa conta interna, então o saldo
-- do cofrinho sai da mesma conta de saldos de sempre (sem contador guardado).
ALTER TYPE "AccountType" ADD VALUE IF NOT EXISTS 'SAVINGS_GOAL';

CREATE TYPE "SavingsGoalStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

CREATE TABLE "savings_goals" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "financial_account_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "target_amount_cents" BIGINT NOT NULL,
    "target_date" DATE,
    "color" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "default_source_account_id" TEXT,
    "status" "SavingsGoalStatus" NOT NULL DEFAULT 'ACTIVE',
    "goal_reached_at" TIMESTAMP(3),
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "savings_goals_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "savings_goals_target_positive" CHECK ("target_amount_cents" > 0)
);

CREATE UNIQUE INDEX "savings_goals_financial_account_id_key" ON "savings_goals"("financial_account_id");
CREATE INDEX "savings_goals_company_id_status_idx" ON "savings_goals"("company_id", "status");

ALTER TABLE "savings_goals" ADD CONSTRAINT "savings_goals_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "savings_goals" ADD CONSTRAINT "savings_goals_financial_account_id_fkey"
  FOREIGN KEY ("financial_account_id") REFERENCES "financial_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "savings_goals" ADD CONSTRAINT "savings_goals_default_source_account_id_fkey"
  FOREIGN KEY ("default_source_account_id") REFERENCES "financial_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Mesmo padrão reforçado das demais tabelas de dados: confere a membership ATIVA por conta própria.
GRANT SELECT, INSERT, UPDATE, DELETE ON "savings_goals" TO ax_app;

ALTER TABLE "savings_goals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "savings_goals" FORCE ROW LEVEL SECURITY;

CREATE POLICY savings_goals_all ON "savings_goals"
  FOR ALL
  USING (
    "company_id" = current_setting('app.current_company_id', true)
    AND EXISTS (
      SELECT 1 FROM "memberships" m
      WHERE m."company_id" = "savings_goals"."company_id"
        AND m."user_id" = current_setting('app.current_user_id', true)
        AND m."status" = 'ACTIVE'
    )
  )
  WITH CHECK (
    "company_id" = current_setting('app.current_company_id', true)
    AND EXISTS (
      SELECT 1 FROM "memberships" m
      WHERE m."company_id" = "savings_goals"."company_id"
        AND m."user_id" = current_setting('app.current_user_id', true)
        AND m."status" = 'ACTIVE'
    )
  );
