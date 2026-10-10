import { randomUUID } from "node:crypto";
import type { ImportJob, OutboxEvent, ScheduledJob } from "@ax-finance/db";
import {
  claimImportJobs,
  claimOutboxEvents,
  claimScheduledJobs,
  completeScheduledJob,
  completeOutboxEvent,
  completeImportJob,
  clearBankImportStorageKey,
  decodeImportSource,
  deleteImportSource,
  failImportJob,
  failScheduledJob,
  failOutboxEvent,
  generateDueNotifications,
  generateDueOccurrences,
  generateMonthlyReports,
  generateWeeklySummary,
  generateSubscriptionNotifications,
  getBankImportBatch,
  logOperationalError,
  runOperationalRetention,
  processBankImportBatch,
  readImportSource,
  setBankImportProcessing,
  structuredLog,
} from "@ax-finance/domain";
import { maybeRunBillingReconciliation } from "./billing-reconciliation";
import { sendOutboxEmail } from "./email";
import { monitorOperations } from "./monitoring";
import { writeWorkerHeartbeat } from "./runtime-health";

export type EventHandler = (event: OutboxEvent) => Promise<void>;
export type ScheduledJobHandler = (job: ScheduledJob) => Promise<void>;
export type ImportJobHandler = (job: ImportJob) => Promise<void>;

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
  if (job.type === "MONTHLY_REPORT") {
    await generateMonthlyReports(job.runAsUserId, job.companyId, applicationBaseUrl());
    return;
  }
  if (job.type === "SUBSCRIPTION_NOTIFICATIONS") {
    await generateSubscriptionNotifications(job.runAsUserId, job.companyId);
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
      logOperationalError("worker.scheduled_job_failed", error, {
        jobId: job.id,
        jobType: job.type,
        attempts: job.attempts + 1,
      });
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
      logOperationalError("worker.outbox_event_failed", error, {
        outboxEventId: event.id,
        outboxEventType: event.type,
        attempts: event.attempts + 1,
      });
    }
  }
  return { claimed: events.length, processed, failed };
}

export async function handleImportJob(job: ImportJob) {
  const batch = await getBankImportBatch(job.runAsUserId, job.companyId, job.importBatchId);
  if (batch.status === "COMPLETED") {
    if (batch.storageKey) {
      await deleteImportSource(batch.storageKey);
      await clearBankImportStorageKey(job.runAsUserId, job.companyId, job.importBatchId);
    }
    return;
  }
  if (!batch.storageKey) throw new Error("ImportSourceUnavailable");
  await setBankImportProcessing(job.runAsUserId, job.companyId, job.importBatchId);
  const bytes = await readImportSource(batch.storageKey);
  await processBankImportBatch(
    job.runAsUserId,
    job.companyId,
    job.importBatchId,
    decodeImportSource(bytes)
  );
  await deleteImportSource(batch.storageKey);
  await clearBankImportStorageKey(job.runAsUserId, job.companyId, job.importBatchId);
}

export async function processImportJobsBatch(
  workerId = `worker-${randomUUID()}`,
  batchSize = Math.max(1, Math.min(5, Number(process.env.IMPORT_WORKER_BATCH_SIZE || "2"))),
  handler: ImportJobHandler = handleImportJob
) {
  const jobs = await claimImportJobs(workerId, batchSize);
  let processed = 0;
  let failed = 0;
  for (const job of jobs) {
    try {
      await handler(job);
      if (!(await completeImportJob(job, workerId))) throw new Error("ImportJobOwnershipLost");
      processed += 1;
    } catch (error) {
      const failure = await failImportJob(job, workerId, error);
      if (failure.finalFailure) {
        const batch = await getBankImportBatch(job.runAsUserId, job.companyId, job.importBatchId).catch(() => null);
        if (batch?.storageKey) {
          await deleteImportSource(batch.storageKey).catch(() => undefined);
          await clearBankImportStorageKey(job.runAsUserId, job.companyId, job.importBatchId).catch(() => undefined);
        }
      }
      failed += 1;
      logOperationalError("worker.import_job_failed", error, {
        importJobId: job.id,
        importBatchId: job.importBatchId,
        attempts: job.attempts + 1,
        finalFailure: failure.finalFailure,
      });
    }
  }
  return { claimed: jobs.length, processed, failed };
}

export async function runOutboxWorker() {
  const workerId = `worker-${randomUUID()}`;
  const intervalMs = Math.max(500, Number(process.env.WORKER_POLL_INTERVAL_MS || "5000"));
  const runOnce = process.env.WORKER_ONCE === "true";
  let stopping = false;
  const stop = () => { stopping = true; };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);

  structuredLog("info", "worker.started", { workerId, intervalMs });
  let lastMaintenance = 0;
  let lastMonitoring = 0;
  // lastRun 0: concilia logo na partida, para recuperar o que se perdeu enquanto o worker esteve parado.
  const billingReconciliation = { lastRun: 0 };
  do {
    const importResult = await processImportJobsBatch(workerId);
    if (importResult.claimed > 0) structuredLog("info", "worker.import_batch_completed", {
      workerId,
      ...importResult,
    });
    const scheduledResult = await processScheduledJobsBatch(workerId);
    if (scheduledResult.claimed > 0) structuredLog("info", "worker.scheduled_batch_completed", {
      workerId,
      ...scheduledResult,
    });
    const outboxResult = await processOutboxBatch(workerId);
    if (outboxResult.claimed > 0) structuredLog("info", "worker.outbox_batch_completed", {
      workerId,
      ...outboxResult,
    });
    if (Date.now() - lastMaintenance > 24 * 60 * 60 * 1000) {
      const retention = await runOperationalRetention();
      structuredLog("info", "worker.retention_completed", retention);
      lastMaintenance = Date.now();
    }
    const monitorIntervalMs = Math.max(30_000, Number(process.env.MONITOR_INTERVAL_MS || "60000"));
    if (Date.now() - lastMonitoring > monitorIntervalMs) {
      await monitorOperations();
      lastMonitoring = Date.now();
    }
    await maybeRunBillingReconciliation(billingReconciliation);
    await writeWorkerHeartbeat(workerId);
    if (!runOnce && !stopping && importResult.claimed === 0 && scheduledResult.claimed === 0 && outboxResult.claimed === 0) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  } while (!runOnce && !stopping);
  structuredLog("info", "worker.stopped", { workerId });
}
