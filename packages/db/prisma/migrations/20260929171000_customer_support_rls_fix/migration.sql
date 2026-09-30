-- A consulta direta a memberships dentro da policy herda o RLS dessa tabela.
-- Centralizamos a checagem em função SECURITY DEFINER, como já ocorre nas
-- políticas de restrição por conta e centro de custo.
CREATE OR REPLACE FUNCTION app_is_company_member(p_company_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM "memberships" m
    WHERE m."user_id" = current_setting('app.current_user_id', true)
      AND m."company_id" = p_company_id
      AND m."status" = 'ACTIVE'
  );
$$;

REVOKE ALL ON FUNCTION app_is_company_member(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_is_company_member(TEXT) TO ax_app;

DROP POLICY support_cases_company_select ON "support_cases";
DROP POLICY support_cases_company_insert ON "support_cases";

CREATE POLICY support_cases_company_select ON "support_cases"
FOR SELECT USING (
  "company_id" = current_setting('app.current_company_id', true)
  AND app_is_company_member("company_id")
);
CREATE POLICY support_cases_company_insert ON "support_cases"
FOR INSERT WITH CHECK (
  "company_id" = current_setting('app.current_company_id', true)
  AND "created_by_user_id" = current_setting('app.current_user_id', true)
  AND app_is_company_member("company_id")
);
