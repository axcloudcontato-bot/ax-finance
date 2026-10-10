-- Cria a tarefa do relatório mensal para as empresas que já existem (as novas ganham ao serem criadas),
-- rodando como o mesmo usuário das demais tarefas da empresa.
INSERT INTO "scheduled_jobs" ("id", "job_key", "type", "company_id", "run_as_user_id", "next_run_at", "created_at", "updated_at")
SELECT gen_random_uuid()::text, 'MONTHLY_REPORT:' || "company_id", 'MONTHLY_REPORT', "company_id", "run_as_user_id", NOW(), NOW(), NOW()
FROM "scheduled_jobs"
WHERE "type" = 'WEEKLY_SUMMARY'
ON CONFLICT ("job_key") DO NOTHING;
