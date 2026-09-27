GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "scheduled_jobs" TO ax_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "notifications" TO ax_app;

DROP POLICY "notifications_insert_company_member" ON "notifications";
CREATE POLICY "notifications_insert_company_member" ON "notifications"
  FOR INSERT
  WITH CHECK (
    "company_id" = current_setting('app.current_company_id', true)
    AND EXISTS (
      SELECT 1 FROM "memberships" actor_membership
      WHERE actor_membership."user_id" = current_setting('app.current_user_id', true)
        AND actor_membership."company_id" = "notifications"."company_id"
        AND actor_membership."status" = 'ACTIVE'
    )
    AND EXISTS (
      SELECT 1 FROM "memberships" target_membership
      WHERE target_membership."user_id" = "notifications"."user_id"
        AND target_membership."company_id" = "notifications"."company_id"
        AND target_membership."status" = 'ACTIVE'
    )
  );
