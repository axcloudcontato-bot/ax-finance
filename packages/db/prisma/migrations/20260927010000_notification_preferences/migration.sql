ALTER TYPE "NotificationType" ADD VALUE 'TITLE_DUE_SOON';

CREATE TABLE "notification_preferences" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "in_app_due" BOOLEAN NOT NULL DEFAULT true,
  "email_due" BOOLEAN NOT NULL DEFAULT true,
  "in_app_weekly" BOOLEAN NOT NULL DEFAULT true,
  "email_weekly" BOOLEAN NOT NULL DEFAULT true,
  "due_days_ahead" INTEGER NOT NULL DEFAULT 0,
  "delivery_hour" INTEGER NOT NULL DEFAULT 8,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notification_preferences_due_days_check" CHECK ("due_days_ahead" BETWEEN 0 AND 30),
  CONSTRAINT "notification_preferences_delivery_hour_check" CHECK ("delivery_hour" BETWEEN 0 AND 23)
);

CREATE UNIQUE INDEX "notification_preferences_user_id_company_id_key"
  ON "notification_preferences"("user_id", "company_id");
CREATE INDEX "notification_preferences_company_id_idx" ON "notification_preferences"("company_id");

ALTER TABLE "notification_preferences"
  ADD CONSTRAINT "notification_preferences_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notification_preferences"
  ADD CONSTRAINT "notification_preferences_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notification_preferences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notification_preferences" FORCE ROW LEVEL SECURITY;

CREATE POLICY "notification_preferences_company_select" ON "notification_preferences"
  FOR SELECT
  USING (
    "company_id" = current_setting('app.current_company_id', true)
    AND EXISTS (
      SELECT 1 FROM "memberships" m
      WHERE m."user_id" = current_setting('app.current_user_id', true)
        AND m."company_id" = "notification_preferences"."company_id"
        AND m."status" = 'ACTIVE'
    )
  );

CREATE POLICY "notification_preferences_own_insert" ON "notification_preferences"
  FOR INSERT
  WITH CHECK (
    "user_id" = current_setting('app.current_user_id', true)
    AND "company_id" = current_setting('app.current_company_id', true)
  );

CREATE POLICY "notification_preferences_own_update" ON "notification_preferences"
  FOR UPDATE
  USING (
    "user_id" = current_setting('app.current_user_id', true)
    AND "company_id" = current_setting('app.current_company_id', true)
  )
  WITH CHECK (
    "user_id" = current_setting('app.current_user_id', true)
    AND "company_id" = current_setting('app.current_company_id', true)
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "notification_preferences" TO ax_app;
