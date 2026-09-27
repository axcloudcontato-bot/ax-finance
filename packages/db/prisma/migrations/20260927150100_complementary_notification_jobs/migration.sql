INSERT INTO "scheduled_jobs" (
  "id", "job_key", "type", "company_id", "run_as_user_id", "next_run_at", "updated_at"
)
SELECT
  gen_random_uuid()::text,
  'SUBSCRIPTION_NOTIFICATIONS:' || c."id",
  'SUBSCRIPTION_NOTIFICATIONS',
  c."id",
  owner_membership."user_id",
  NOW() AT TIME ZONE 'UTC',
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
ON CONFLICT ("job_key") DO NOTHING;
