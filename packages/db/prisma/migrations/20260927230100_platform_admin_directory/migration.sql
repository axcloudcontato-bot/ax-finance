CREATE POLICY platform_admins_admin_select ON "platform_admins" FOR SELECT
  USING (app_is_platform_admin());
