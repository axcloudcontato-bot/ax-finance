ALTER TYPE "OutboxEventType" ADD VALUE 'DUE_DATE_SUMMARY';
ALTER TYPE "OutboxEventType" ADD VALUE 'WEEKLY_SUMMARY';

CREATE TYPE "ScheduledJobType" AS ENUM (
  'GENERATE_RECURRENCES',
  'DUE_NOTIFICATIONS',
  'WEEKLY_SUMMARY'
);

CREATE TYPE "NotificationType" AS ENUM (
  'TITLE_DUE_TODAY',
  'TITLE_OVERDUE',
  'WEEKLY_SUMMARY'
);

CREATE TABLE "scheduled_jobs" (
  "id" TEXT NOT NULL,
  "job_key" TEXT NOT NULL,
  "type" "ScheduledJobType" NOT NULL,
  "company_id" TEXT NOT NULL,
  "run_as_user_id" TEXT NOT NULL,
  "next_run_at" TIMESTAMP(3) NOT NULL,
  "locked_at" TIMESTAMP(3),
  "locked_by" TEXT,
  "last_completed_at" TIMESTAMP(3),
  "last_error" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "scheduled_jobs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "scheduled_jobs_job_key_key" ON "scheduled_jobs"("job_key");
CREATE INDEX "scheduled_jobs_next_run_at_idx" ON "scheduled_jobs"("next_run_at");
CREATE INDEX "scheduled_jobs_company_id_idx" ON "scheduled_jobs"("company_id");

ALTER TABLE "scheduled_jobs"
  ADD CONSTRAINT "scheduled_jobs_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "scheduled_jobs"
  ADD CONSTRAINT "scheduled_jobs_run_as_user_id_fkey"
  FOREIGN KEY ("run_as_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "notifications" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "type" "NotificationType" NOT NULL,
  "dedup_key" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "href" TEXT NOT NULL,
  "read_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notifications_dedup_key_key" ON "notifications"("dedup_key");
CREATE INDEX "notifications_user_id_company_id_read_at_created_at_idx"
  ON "notifications"("user_id", "company_id", "read_at", "created_at");

ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notifications" FORCE ROW LEVEL SECURITY;

CREATE POLICY "notifications_select_own" ON "notifications"
  FOR SELECT
  USING (
    "user_id" = current_setting('app.current_user_id', true)
    AND "company_id" = current_setting('app.current_company_id', true)
    AND EXISTS (
      SELECT 1 FROM "memberships" m
      WHERE m."user_id" = current_setting('app.current_user_id', true)
        AND m."company_id" = "notifications"."company_id"
        AND m."status" = 'ACTIVE'
    )
  );

CREATE POLICY "notifications_insert_company_member" ON "notifications"
  FOR INSERT
  WITH CHECK (
    "company_id" = current_setting('app.current_company_id', true)
    AND EXISTS (
      SELECT 1 FROM "memberships" m
      WHERE m."user_id" = current_setting('app.current_user_id', true)
        AND m."company_id" = "notifications"."company_id"
        AND m."status" = 'ACTIVE'
    )
  );

CREATE POLICY "notifications_update_own" ON "notifications"
  FOR UPDATE
  USING (
    "user_id" = current_setting('app.current_user_id', true)
    AND "company_id" = current_setting('app.current_company_id', true)
  )
  WITH CHECK (
    "user_id" = current_setting('app.current_user_id', true)
    AND "company_id" = current_setting('app.current_company_id', true)
  );

-- Os agendamentos não carregam dados financeiros; apenas identificadores e a
-- identidade do proprietário sob a qual o job deve abrir o contexto RLS.
INSERT INTO "scheduled_jobs" (
  "id", "job_key", "type", "company_id", "run_as_user_id", "next_run_at", "updated_at"
)
SELECT
  gen_random_uuid()::text,
  job."type"::text || ':' || c."id",
  job."type",
  c."id",
  owner_membership."user_id",
  CASE
    WHEN job."type" = 'WEEKLY_SUMMARY' THEN
      date_trunc('week', NOW() AT TIME ZONE 'UTC') + interval '7 days 12 hours'
    ELSE NOW() AT TIME ZONE 'UTC'
  END,
  NOW() AT TIME ZONE 'UTC'
FROM "companies" c
JOIN LATERAL (
  SELECT m."user_id"
  FROM "memberships" m
  WHERE m."company_id" = c."id"
    AND m."role" = 'OWNER'
    AND m."status" = 'ACTIVE'
  ORDER BY m."created_at" ASC
  LIMIT 1
) owner_membership ON TRUE
CROSS JOIN (
  VALUES
    ('GENERATE_RECURRENCES'::"ScheduledJobType"),
    ('DUE_NOTIFICATIONS'::"ScheduledJobType"),
    ('WEEKLY_SUMMARY'::"ScheduledJobType")
) AS job("type");
