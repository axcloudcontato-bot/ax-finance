-- O painel interno só precisa de CONTAGENS por empresa (contas, títulos, ativação),
-- mas as políticas criadas em 20260927230000_internal_admin_panel davam SELECT em
-- titles, settlements e financial_accounts de TODAS as empresas a qualquer
-- platform admin (inclusive ANALYST). DIRECAO §17: o administrador do SaaS não
-- recebe acesso irrestrito aos dados financeiros.
DROP POLICY IF EXISTS titles_platform_admin_select ON "titles";
DROP POLICY IF EXISTS settlements_platform_admin_select ON "settlements";
DROP POLICY IF EXISTS financial_accounts_platform_admin_select ON "financial_accounts";

-- Agregados por empresa, sem nenhum valor ou descrição. SECURITY DEFINER para
-- contar além do RLS; o WHERE app_is_platform_admin() devolve zero linhas para
-- qualquer outro chamador.
CREATE OR REPLACE FUNCTION app_admin_company_stats()
RETURNS TABLE (
  company_id TEXT,
  created_at TIMESTAMP(3),
  accounts_count BIGINT,
  titles_count BIGINT,
  active_titles_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    c.id,
    c.created_at,
    (SELECT count(*) FROM public.financial_accounts a WHERE a.company_id = c.id),
    (SELECT count(*) FROM public.titles t WHERE t.company_id = c.id),
    (SELECT count(*) FROM public.titles t WHERE t.company_id = c.id AND t.deleted_at IS NULL)
  FROM public.companies c
  WHERE public.app_is_platform_admin()
$$;

REVOKE ALL ON FUNCTION app_admin_company_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_admin_company_stats() TO ax_app;
