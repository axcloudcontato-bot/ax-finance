-- Clientes autenticados podem criar e acompanhar chamados da própria empresa.
-- A política administrativa existente permanece com acesso completo.
CREATE POLICY support_cases_company_select ON "support_cases"
FOR SELECT USING (
  "company_id" = current_setting('app.current_company_id', true)
  AND EXISTS (
    SELECT 1 FROM "memberships" m
    WHERE m."user_id" = current_setting('app.current_user_id', true)
      AND m."company_id" = "support_cases"."company_id"
      AND m."status" = 'ACTIVE'
  )
);

CREATE POLICY support_cases_company_insert ON "support_cases"
FOR INSERT WITH CHECK (
  "company_id" = current_setting('app.current_company_id', true)
  AND "created_by_user_id" = current_setting('app.current_user_id', true)
  AND EXISTS (
    SELECT 1 FROM "memberships" m
    WHERE m."user_id" = current_setting('app.current_user_id', true)
      AND m."company_id" = "support_cases"."company_id"
      AND m."status" = 'ACTIVE'
  )
);
