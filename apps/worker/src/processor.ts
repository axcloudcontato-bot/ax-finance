import { randomUUID } from "node:crypto";
import type { OutboxEvent, ScheduledJob } from "@ax-finance/db";
import {
  claimOutboxEvents,
  claimScheduledJobs,
  completeScheduledJob,
  completeOutboxEvent,
  failScheduledJob,
  failOutboxEvent,
  generateDueNotifications,
  generateDueOccurrences,
  generateWeeklySummary,
  purgeProcessedOutboxEvents,
} from "@ax-finance/domain";
import { sendOutboxEmail } from "./email";

export type EventHandler = (event: OutboxEvent) => Promise<void>;
export type ScheduledJobHandler = (job: ScheduledJob) => Promise<void>;

function applicationBaseUrl() {
  const configured = process.env.APP_BASE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  if (process.env.NODE_ENV === "production") throw new Error("APP_BASE_URL não configurada no worker.");
  return "http://localhost:3000";
}

export async function handleScheduledJob(job: ScheduledJob) {
  if (job.type === "GENERATE_RECURRENCES") {
    await generateDueOccurrences(job.runAsUserId, job.companyId);
    return;
  }
  if (job.type === "DUE_NOTIFICATIONS") {
    await generateDueNotifications(job.runAsUserId, job.companyId, applicationBaseUrl());
    return;
  }
  if (job.type === "WEEKLY_SUMMARY") {
    await generateWeeklySummary(job.runAsUserId, job.companyId, applicationBaseUrl());
    return;
  }
  throw new Error(`Job agendado não suportado: ${job.type}`);
}

export async function processScheduledJobsBatch(
  workerId = `worker-${randomUUID()}`,
  batchSize = Number(process.env.WORKER_BATCH_SIZE || "10"),
  handler: ScheduledJobHandler = handleScheduledJob
) {
  const jobs = await claimScheduledJobs(workerId, batchSize);
  let processed = 0;
  let failed = 0;
  for (const job of jobs) {
    try {
      await handler(job);
      if (!(await completeScheduledJob(job, workerId))) {
        throw new Error("O worker perdeu a posse do job antes da confirmação.");
      }
      processed += 1;
    } catch (error) {
      await failScheduledJob(job, workerId, error);
      failed += 1;
      console.error(`[scheduled-job:${job.id}] falha no processamento`, error);
    }
  }
  return { claimed: jobs.length, processed, failed };
}

export async function processOutboxBatch(
  workerId = `worker-${randomUUID()}`,
  batchSize = Number(process.env.WORKER_BATCH_SIZE || "10"),
  handler: EventHandler = sendOutboxEmail
) {
  const events = await claimOutboxEvents(workerId, batchSize);
  let processed = 0;
  let failed = 0;
  for (const event of events) {
    try {
      await handler(event);
      if (!(await completeOutboxEvent(event.id, workerId))) {
        throw new Error("O worker perdeu a posse do evento antes da confirmação.");
      }
      processed += 1;
    } catch (error) {
      await failOutboxEvent(event.id, workerId, error);
      failed += 1;
      console.error(`[outbox:${event.id}] falha no processamento`, error);
    }
  }
  return { claimed: events.length, processed, failed };
}

export async function runOutboxWorker() {
  const workerId = `worker-${randomUUID()}`;
  const intervalMs = Math.max(500, Number(process.env.WORKER_POLL_INTERVAL_MS || "5000"));
  const runOnce = process.env.WORKER_ONCE === "true";
  let stopping = false;
  const stop = () => { stopping = true; };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);

  console.info(`[${workerId}] worker de outbox iniciado`);
  let lastPurge = 0;
  do {
    const scheduledResult = await processScheduledJobsBatch(workerId);
    if (scheduledResult.claimed > 0) console.info(`[${workerId}] jobs agendados concluídos`, scheduledResult);
    const outboxResult = await processOutboxBatch(workerId);
    if (outboxResult.claimed > 0) console.info(`[${workerId}] lote de outbox concluído`, outboxResult);
    if (Date.now() - lastPurge > 24 * 60 * 60 * 1000) {
      await purgeProcessedOutboxEvents();
      lastPurge = Date.now();
    }
    if (!runOnce && !stopping && scheduledResult.claimed === 0 && outboxResult.claimed === 0) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  } while (!runOnce && !stopping);
  console.info(`[${workerId}] worker de outbox encerrado`);
}
