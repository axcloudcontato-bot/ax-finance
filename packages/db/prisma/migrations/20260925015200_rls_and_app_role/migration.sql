-- Isolamento multiempresa em profundidade (DIRECAO.md, Seções 17/20/22).
--
-- A aplicação NUNCA deve se conectar ao Postgres com o superusuário usado
-- para rodar migrations (aqui, "postgres"): superusuário e dono de tabela
-- ignoram Row Level Security por padrão, mesmo com FORCE ROW LEVEL SECURITY.
-- Por isso criamos um role de aplicação com privilégios mínimos, que é quem
-- de fato fica sujeito às políticas abaixo. `APP_DATABASE_URL` (não
-- `DATABASE_URL`) deve usar este role em runtime.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'ax_app') THEN
    CREATE ROLE ax_app LOGIN PASSWORD 'OMe21B_Wkcck4aQcsck8NQ_3';
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO ax_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ax_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ax_app;

-- companies ------------------------------------------------------------
ALTER TABLE "companies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "companies" FORCE ROW LEVEL SECURITY;

-- Qualquer usuário autenticado pode criar uma empresa (ela nasce sem
-- membership; a membership de OWNER é criada na mesma transação, antes de
-- qualquer leitura subsequente — ver packages/domain/src/companies/create-company.ts).
CREATE POLICY companies_insert ON "companies"
  FOR INSERT
  WITH CHECK (current_setting('app.current_user_id', true) IS NOT NULL);

CREATE POLICY companies_select ON "companies"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "memberships" m
      WHERE m."company_id" = "companies"."id"
        AND m."user_id" = current_setting('app.current_user_id', true)
        AND m."status" = 'ACTIVE'
    )
  );

CREATE POLICY companies_update ON "companies"
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM "memberships" m
      WHERE m."company_id" = "companies"."id"
        AND m."user_id" = current_setting('app.current_user_id', true)
        AND m."status" = 'ACTIVE'
    )
  );

-- memberships ------------------------------------------------------------
ALTER TABLE "memberships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "memberships" FORCE ROW LEVEL SECURITY;

CREATE POLICY memberships_insert ON "memberships"
  FOR INSERT
  WITH CHECK (current_setting('app.current_user_id', true) IS NOT NULL);

-- Você sempre enxerga sua própria membership (para "quais empresas eu vejo"
-- sem uma empresa ativa escolhida ainda); e, quando uma empresa está ativa
-- no contexto (app.current_company_id setado após checar sua própria
-- membership em application code), você vê os outros membros dela.
CREATE POLICY memberships_select ON "memberships"
  FOR SELECT
  USING (
    "user_id" = current_setting('app.current_user_id', true)
    OR "company_id" = current_setting('app.current_company_id', true)
  );

CREATE POLICY memberships_update ON "memberships"
  FOR UPDATE
  USING ("company_id" = current_setting('app.current_company_id', true));

-- financial_accounts ------------------------------------------------------
ALTER TABLE "financial_accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "financial_accounts" FORCE ROW LEVEL SECURITY;

-- Esta é a tabela com dinheiro de verdade, então a política não confia só em
-- app.current_company_id ter sido setado corretamente pela aplicação: ela
-- também confere, independentemente, que o usuário autenticado tem
-- membership ATIVA naquela empresa. Isso é o que torna o isolamento
-- verificável mesmo se um caso de uso futuro esquecer de chamar
-- assertActiveMembership antes de abrir o contexto — o critério de aceite
-- FIN-001 ("cliente A tenta ID de B: acesso negado em todas as rotas") vale
-- mesmo com um bug de camada de aplicação.
CREATE POLICY financial_accounts_all ON "financial_accounts"
  FOR ALL
  USING (
    "company_id" = current_setting('app.current_company_id', true)
    AND EXISTS (
      SELECT 1 FROM "memberships" m
      WHERE m."company_id" = "financial_accounts"."company_id"
        AND m."user_id" = current_setting('app.current_user_id', true)
        AND m."status" = 'ACTIVE'
    )
  )
  WITH CHECK (
    "company_id" = current_setting('app.current_company_id', true)
    AND EXISTS (
      SELECT 1 FROM "memberships" m
      WHERE m."company_id" = "financial_accounts"."company_id"
        AND m."user_id" = current_setting('app.current_user_id', true)
        AND m."status" = 'ACTIVE'
    )
  );

-- users, sessions e tenants não têm política de linha nesta etapa:
-- users/sessions são sempre acessados por chave única (id/e-mail/token) na
-- camada de aplicação, nunca por varredura; tenants só é lido através de
-- companies, que já é protegida acima. Reavaliar quando o painel
-- administrativo interno (Seção 24) precisar de acesso amplo e controlado.
