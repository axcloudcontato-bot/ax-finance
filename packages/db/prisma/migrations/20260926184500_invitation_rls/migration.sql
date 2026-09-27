-- Convites contêm e-mail e pertencem a uma empresa, portanto também ficam
-- sujeitos a RLS. Proprietários gerenciam no contexto da empresa; o
-- destinatário só enxerga/aceita o convite ligado ao próprio e-mail.
ALTER TABLE "company_invitations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "company_invitations" FORCE ROW LEVEL SECURITY;

CREATE POLICY company_invitations_owner_all ON "company_invitations"
  FOR ALL
  USING (
    "company_id" = current_setting('app.current_company_id', true)
    AND EXISTS (
      SELECT 1 FROM "memberships" m
      WHERE m."company_id" = "company_invitations"."company_id"
        AND m."user_id" = current_setting('app.current_user_id', true)
        AND m."status" = 'ACTIVE'
        AND m."role" = 'OWNER'
    )
  )
  WITH CHECK (
    "company_id" = current_setting('app.current_company_id', true)
    AND EXISTS (
      SELECT 1 FROM "memberships" m
      WHERE m."company_id" = "company_invitations"."company_id"
        AND m."user_id" = current_setting('app.current_user_id', true)
        AND m."status" = 'ACTIVE'
        AND m."role" = 'OWNER'
    )
  );

CREATE POLICY company_invitations_recipient_select ON "company_invitations"
  FOR SELECT
  USING (
    "email" = (
      SELECT lower(u."email") FROM "users" u
      WHERE u."id" = current_setting('app.current_user_id', true)
    )
  );

CREATE POLICY company_invitations_recipient_update ON "company_invitations"
  FOR UPDATE
  USING (
    "status" = 'PENDING'
    AND "email" = (
      SELECT lower(u."email") FROM "users" u
      WHERE u."id" = current_setting('app.current_user_id', true)
    )
  )
  WITH CHECK (
    "email" = (
      SELECT lower(u."email") FROM "users" u
      WHERE u."id" = current_setting('app.current_user_id', true)
    )
  );
