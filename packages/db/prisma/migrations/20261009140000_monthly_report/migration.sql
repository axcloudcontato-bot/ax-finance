-- Relatório mensal em PDF por e-mail: tarefa agendada por empresa, evento de e-mail e a preferência
-- de cada pessoa. Os valores novos dos enums ficam numa migração e o uso deles na seguinte, porque o
-- PostgreSQL não deixa usar um valor de enum na mesma transação em que ele foi criado.
ALTER TYPE "ScheduledJobType" ADD VALUE IF NOT EXISTS 'MONTHLY_REPORT';
ALTER TYPE "OutboxEventType" ADD VALUE IF NOT EXISTS 'MONTHLY_REPORT';

ALTER TABLE "notification_preferences" ADD COLUMN "email_monthly_report" BOOLEAN NOT NULL DEFAULT true;
