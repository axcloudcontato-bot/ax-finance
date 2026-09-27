-- Os jobs de comunicação verificam preferências horárias individuais. Eles
-- acordam a cada hora; as chaves de deduplicação impedem reenvios no período.
UPDATE "scheduled_jobs"
SET "next_run_at" = NOW() AT TIME ZONE 'UTC', "updated_at" = NOW() AT TIME ZONE 'UTC'
WHERE "type" IN ('DUE_NOTIFICATIONS', 'WEEKLY_SUMMARY');
