CREATE TYPE "PlatformAdminRole" AS ENUM ('SUPER_ADMIN', 'OPERATIONS', 'SUPPORT', 'ANALYST');
CREATE TYPE "SupportCaseStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED');
CREATE TYPE "SupportCasePriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');
CREATE TYPE "IncidentStatus" AS ENUM ('INVESTIGATING', 'IDENTIFIED', 'MONITORING', 'RESOLVED');
CREATE TYPE "IncidentSeverity" AS ENUM ('SEV1', 'SEV2', 'SEV3', 'SEV4');

CREATE TABLE "platform_admins" (
  "user_id" TEXT NOT NULL,
  "role" "PlatformAdminRole" NOT NULL DEFAULT 'ANALYST',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "platform_admins_pkey" PRIMARY KEY ("user_id")
);

CREATE TABLE "admin_audit_events" (
  "id" TEXT NOT NULL,
  "actor_user_id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "target_type" TEXT NOT NULL,
  "target_id" TEXT,
  "summary" TEXT NOT NULL,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admin_audit_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "support_cases" (
  "id" TEXT NOT NULL,
  "company_id" TEXT,
  "subject" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "contact_email" TEXT,
  "priority" "SupportCasePriority" NOT NULL DEFAULT 'NORMAL',
  "status" "SupportCaseStatus" NOT NULL DEFAULT 'OPEN',
  "created_by_user_id" TEXT NOT NULL,
  "assigned_to_user_id" TEXT,
  "resolution" TEXT,
  "resolved_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "support_cases_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "incidents" (
  "id" TEXT NOT NULL,
  "company_id" TEXT,
  "title" TEXT NOT NULL,
  "severity" "IncidentSeverity" NOT NULL,
  "status" "IncidentStatus" NOT NULL DEFAULT 'INVESTIGATING',
  "public_message" TEXT NOT NULL,
  "internal_summary" TEXT,
  "created_by_user_id" TEXT NOT NULL,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolved_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "platform_admins_role_active_idx" ON "platform_admins"("role", "active");
CREATE INDEX "admin_audit_events_actor_user_id_created_at_idx" ON "admin_audit_events"("actor_user_id", "created_at");
CREATE INDEX "admin_audit_events_target_type_target_id_created_at_idx" ON "admin_audit_events"("target_type", "target_id", "created_at");
CREATE INDEX "support_cases_status_priority_created_at_idx" ON "support_cases"("status", "priority", "created_at");
CREATE INDEX "support_cases_company_id_created_at_idx" ON "support_cases"("company_id", "created_at");
CREATE INDEX "incidents_status_severity_started_at_idx" ON "incidents"("status", "severity", "started_at");
CREATE INDEX "incidents_company_id_started_at_idx" ON "incidents"("company_id", "started_at");

ALTER TABLE "platform_admins" ADD CONSTRAINT "platform_admins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "admin_audit_events" ADD CONSTRAINT "admin_audit_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_assigned_to_user_id_fkey" FOREIGN KEY ("assigned_to_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION app_is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins a
    JOIN public.users u ON u.id = a.user_id
    WHERE a.user_id = current_setting('app.current_user_id', true)
      AND a.active = true
      AND u.status = 'ACTIVE'
  )
$$;

REVOKE ALL ON FUNCTION app_is_platform_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_is_platform_admin() TO ax_app;

ALTER TABLE "platform_admins" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "platform_admins" FORCE ROW LEVEL SECURITY;
CREATE POLICY platform_admins_own_select ON "platform_admins" FOR SELECT
  USING ("user_id" = current_setting('app.current_user_id', true) AND "active" = true);

ALTER TABLE "admin_audit_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "admin_audit_events" FORCE ROW LEVEL SECURITY;
CREATE POLICY admin_audit_events_select ON "admin_audit_events" FOR SELECT USING (app_is_platform_admin());
CREATE POLICY admin_audit_events_insert ON "admin_audit_events" FOR INSERT WITH CHECK (app_is_platform_admin() AND "actor_user_id" = current_setting('app.current_user_id', true));

ALTER TABLE "support_cases" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "support_cases" FORCE ROW LEVEL SECURITY;
CREATE POLICY support_cases_admin_all ON "support_cases" FOR ALL USING (app_is_platform_admin()) WITH CHECK (app_is_platform_admin());

ALTER TABLE "incidents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "incidents" FORCE ROW LEVEL SECURITY;
CREATE POLICY incidents_admin_all ON "incidents" FOR ALL USING (app_is_platform_admin()) WITH CHECK (app_is_platform_admin());

CREATE POLICY companies_platform_admin_select ON "companies" FOR SELECT USING (app_is_platform_admin());
CREATE POLICY memberships_platform_admin_select ON "memberships" FOR SELECT USING (app_is_platform_admin());
CREATE POLICY financial_accounts_platform_admin_select ON "financial_accounts" FOR SELECT USING (app_is_platform_admin());
CREATE POLICY titles_platform_admin_select ON "titles" FOR SELECT USING (app_is_platform_admin());
CREATE POLICY settlements_platform_admin_select ON "settlements" FOR SELECT USING (app_is_platform_admin());
CREATE POLICY subscriptions_platform_admin_select ON "subscriptions" FOR SELECT USING (app_is_platform_admin());
CREATE POLICY subscriptions_platform_admin_update ON "subscriptions" FOR UPDATE USING (app_is_platform_admin()) WITH CHECK (app_is_platform_admin());
CREATE POLICY import_batches_platform_admin_select ON "import_batches" FOR SELECT USING (app_is_platform_admin());
CREATE POLICY import_batches_platform_admin_update ON "import_batches" FOR UPDATE USING (app_is_platform_admin()) WITH CHECK (app_is_platform_admin());

GRANT SELECT ON TABLE "platform_admins" TO ax_app;
REVOKE INSERT, UPDATE, DELETE ON TABLE "platform_admins" FROM ax_app;
GRANT SELECT, INSERT ON TABLE "admin_audit_events" TO ax_app;
REVOKE UPDATE, DELETE ON TABLE "admin_audit_events" FROM ax_app;
GRANT SELECT, INSERT, UPDATE ON TABLE "support_cases", "incidents" TO ax_app;
REVOKE DELETE ON TABLE "support_cases", "incidents" FROM ax_app;
