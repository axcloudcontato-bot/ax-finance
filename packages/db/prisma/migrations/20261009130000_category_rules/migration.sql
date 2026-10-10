-- Regras de categoria: "descrição contém UBER → Transporte / centro Comercial". Preenchem a categoria
-- (e, se houver, centro de custo e pessoa) dos lançamentos novos e das linhas de extrato lançadas pela
-- conciliação. Só parâmetro do usuário: nenhuma regra altera lançamento já gravado.
CREATE TYPE "CategoryRuleMatch" AS ENUM ('CONTAINS', 'STARTS_WITH', 'EQUALS');
CREATE TYPE "CategoryRuleScope" AS ENUM ('RECEIVABLE', 'PAYABLE', 'BOTH');

CREATE TABLE "category_rules" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "pattern" TEXT NOT NULL,
    "match_type" "CategoryRuleMatch" NOT NULL DEFAULT 'CONTAINS',
    "applies_to" "CategoryRuleScope" NOT NULL DEFAULT 'BOTH',
    "category_id" TEXT NOT NULL,
    "cost_center_id" TEXT,
    "party_id" TEXT,
    "times_applied" INTEGER NOT NULL DEFAULT 0,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "category_rules_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "category_rules_pattern_not_blank" CHECK (length(btrim("pattern")) >= 2)
);

CREATE INDEX "category_rules_company_id_idx" ON "category_rules"("company_id");

ALTER TABLE "category_rules" ADD CONSTRAINT "category_rules_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "category_rules" ADD CONSTRAINT "category_rules_category_id_company_id_fkey"
  FOREIGN KEY ("category_id", "company_id") REFERENCES "categories"("id", "company_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "category_rules" ADD CONSTRAINT "category_rules_cost_center_id_company_id_fkey"
  FOREIGN KEY ("cost_center_id", "company_id") REFERENCES "cost_centers"("id", "company_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "category_rules" ADD CONSTRAINT "category_rules_party_id_company_id_fkey"
  FOREIGN KEY ("party_id", "company_id") REFERENCES "parties"("id", "company_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Mesmo padrão reforçado das demais tabelas de dados: confere a membership ATIVA por conta própria.
GRANT SELECT, INSERT, UPDATE, DELETE ON "category_rules" TO ax_app;

ALTER TABLE "category_rules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "category_rules" FORCE ROW LEVEL SECURITY;

CREATE POLICY category_rules_all ON "category_rules"
  FOR ALL
  USING (
    "company_id" = current_setting('app.current_company_id', true)
    AND EXISTS (
      SELECT 1 FROM "memberships" m
      WHERE m."company_id" = "category_rules"."company_id"
        AND m."user_id" = current_setting('app.current_user_id', true)
        AND m."status" = 'ACTIVE'
    )
  )
  WITH CHECK (
    "company_id" = current_setting('app.current_company_id', true)
    AND EXISTS (
      SELECT 1 FROM "memberships" m
      WHERE m."company_id" = "category_rules"."company_id"
        AND m."user_id" = current_setting('app.current_user_id', true)
        AND m."status" = 'ACTIVE'
    )
  );
