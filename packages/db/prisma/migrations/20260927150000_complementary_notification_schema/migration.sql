ALTER TYPE "OutboxEventType" ADD VALUE 'COMPANY_INVITATION';
ALTER TYPE "OutboxEventType" ADD VALUE 'ACCESS_CHANGED';
ALTER TYPE "OutboxEventType" ADD VALUE 'IMPORT_FAILED';
ALTER TYPE "OutboxEventType" ADD VALUE 'BILLING_NOTICE';

ALTER TYPE "ScheduledJobType" ADD VALUE 'SUBSCRIPTION_NOTIFICATIONS';

ALTER TYPE "NotificationType" ADD VALUE 'INVITATION_ACCEPTED';
ALTER TYPE "NotificationType" ADD VALUE 'ACCESS_ROLE_CHANGED';
ALTER TYPE "NotificationType" ADD VALUE 'BILLING_TRIAL_ENDING';
ALTER TYPE "NotificationType" ADD VALUE 'BILLING_TRIAL_ENDED';
ALTER TYPE "NotificationType" ADD VALUE 'BILLING_PAYMENT_DUE';
ALTER TYPE "NotificationType" ADD VALUE 'BILLING_PAYMENT_FAILED';
ALTER TYPE "NotificationType" ADD VALUE 'BILLING_GRACE_PERIOD';
ALTER TYPE "NotificationType" ADD VALUE 'BILLING_CANCELLATION_SCHEDULED';
ALTER TYPE "NotificationType" ADD VALUE 'BILLING_CANCELLED';

CREATE TYPE "SubscriptionStatus" AS ENUM (
  'TRIAL',
  'ACTIVE',
  'PAYMENT_PENDING',
  'GRACE_PERIOD',
  'SUSPENDED',
  'CANCELLATION_SCHEDULED',
  'CANCELLED'
);

CREATE TABLE "subscriptions" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIAL',
  "plan_code" TEXT NOT NULL DEFAULT 'TRIAL',
  "trial_ends_at" TIMESTAMP(3),
  "current_period_end" TIMESTAMP(3),
  "grace_ends_at" TIMESTAMP(3),
  "cancellation_effective_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "subscriptions_company_id_key" ON "subscriptions"("company_id");
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");

ALTER TABLE "subscriptions"
  ADD CONSTRAINT "subscriptions_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "subscriptions" (
  "id", "company_id", "status", "plan_code", "trial_ends_at", "created_at", "updated_at"
)
SELECT
  gen_random_uuid()::text,
  c."id",
  'TRIAL',
  'TRIAL',
  c."created_at" + interval '14 days',
  c."created_at",
  NOW() AT TIME ZONE 'UTC'
FROM "companies" c
ON CONFLICT ("company_id") DO NOTHING;

ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subscriptions" FORCE ROW LEVEL SECURITY;

CREATE POLICY "subscriptions_company_select" ON "subscriptions"
  FOR SELECT
  USING (
    "company_id" = current_setting('app.current_company_id', true)
    AND EXISTS (
      SELECT 1 FROM "memberships" m
      WHERE m."user_id" = current_setting('app.current_user_id', true)
        AND m."company_id" = "subscriptions"."company_id"
        AND m."status" = 'ACTIVE'
    )
  );

CREATE POLICY "subscriptions_owner_insert" ON "subscriptions"
  FOR INSERT
  WITH CHECK (
    "company_id" = current_setting('app.current_company_id', true)
    AND EXISTS (
      SELECT 1 FROM "memberships" m
      WHERE m."user_id" = current_setting('app.current_user_id', true)
        AND m."company_id" = "subscriptions"."company_id"
        AND m."status" = 'ACTIVE'
        AND m."role" = 'OWNER'
    )
  );

CREATE POLICY "subscriptions_owner_update" ON "subscriptions"
  FOR UPDATE
  USING (
    "company_id" = current_setting('app.current_company_id', true)
    AND EXISTS (
      SELECT 1 FROM "memberships" m
      WHERE m."user_id" = current_setting('app.current_user_id', true)
        AND m."company_id" = "subscriptions"."company_id"
        AND m."status" = 'ACTIVE'
        AND m."role" = 'OWNER'
    )
  )
  WITH CHECK (
    "company_id" = current_setting('app.current_company_id', true)
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "subscriptions" TO ax_app;
