import { withUserContext } from "@ax-finance/db";
import { z } from "zod";
import { AdminJobReprocessInvalidError } from "../errors";
import { getOperationalDiagnostics } from "../operations/diagnostics";
import { assertPlatformAdminInTx, recordAdminAudit } from "./access";

const STALE_MS = 30 * 60 * 1000;

function safeStoredError(value: string | null) {
  if (!value) return null;
  return /^[A-Za-z][A-Za-z0-9_.-]{0,79}(?::[A-Za-z0-9_.-]{1,80})?$/.test(value) ? value : "LegacyError";
}

export async function getAdminOperations(userId: string, now = new Date()) {
  const diagnostics = await getOperationalDiagnostics(now);
  return withUserContext(userId, async (tx) => {
    await assertPlatformAdminInTx(tx, userId);
    const [scheduledJobs, importJobs, deadLetters, auditEvents] = await Promise.all([
      tx.scheduledJob.findMany({
        where: { OR: [{ attempts: { gt: 0 } }, { lockedAt: { lt: new Date(now.getTime() - STALE_MS) } }, { nextRunAt: { lt: new Date(now.getTime() - 5 * 60_000) }, lockedAt: null }] },
        include: { company: { select: { name: true } } }, orderBy: [{ attempts: "desc" }, { updatedAt: "desc" }], take: 100,
      }),
      tx.importJob.findMany({
        where: { OR: [{ status: "FAILED" }, { status: "PROCESSING", lockedAt: { lt: new Date(now.getTime() - STALE_MS) } }] },
        include: { company: { select: { name: true } }, importBatch: { select: { fileName: true, status: true } } }, orderBy: { updatedAt: "desc" }, take: 100,
      }),
      tx.outboxEvent.findMany({ where: { status: "DEAD_LETTER" }, select: { id: true, type: true, attempts: true, createdAt: true, updatedAt: true, lastError: true, payloadEncrypted: true }, orderBy: { updatedAt: "desc" }, take: 100 }),
      tx.adminAuditEvent.findMany({ include: { actor: { select: { name: true, email: true } } }, orderBy: { createdAt: "desc" }, take: 50 }),
    ]);
    return {
      diagnostics,
      scheduledJobs: scheduledJobs.map((item) => ({ ...item, lastError: safeStoredError(item.lastError) })),
      importJobs: importJobs.map((item) => ({ ...item, lastError: safeStoredError(item.lastError) })),
      deadLetters: deadLetters.map(({payloadEncrypted,...item}) => ({...item, lastError: safeStoredError(item.lastError), canReprocess:Boolean(payloadEncrypted)})),
      auditEvents,
    };
  });
}

const reprocessInput = z.object({ reason: z.string().trim().min(1).max(500) });

export async function reprocessScheduledJob(userId: string, jobId: string, input: unknown) {
  const data = reprocessInput.parse(input);
  return withUserContext(userId, async (tx) => {
    await assertPlatformAdminInTx(tx, userId, ["SUPER_ADMIN", "OPERATIONS"]);
    const rows = await tx.$queryRaw<Array<{ id: string; attempts: number; locked_at: Date | null; next_run_at: Date }>>`
      SELECT id, attempts, locked_at, next_run_at FROM scheduled_jobs WHERE id = ${jobId} FOR UPDATE
    `;
    const job = rows[0]; const now = new Date();
    if (!job) throw new AdminJobReprocessInvalidError("Job agendado não encontrado.");
    const stale = job.locked_at && job.locked_at.getTime() < now.getTime() - STALE_MS;
    const overdue = job.next_run_at.getTime() < now.getTime() - 5 * 60_000;
    if (job.attempts === 0 && !stale && !overdue) throw new AdminJobReprocessInvalidError();
    const updated = await tx.scheduledJob.update({ where: { id: jobId }, data: { nextRunAt: now, lockedAt: null, lockedBy: null, attempts: 0, lastError: null } });
    await recordAdminAudit(tx, { actorUserId: userId, action: "SCHEDULED_JOB_REPROCESSED", targetType: "ScheduledJob", targetId: jobId, summary: data.reason });
    return updated;
  });
}

export async function reprocessImportJob(userId: string, jobId: string, input: unknown) {
  const data = reprocessInput.parse(input);
  return withUserContext(userId, async (tx) => {
    await assertPlatformAdminInTx(tx, userId, ["SUPER_ADMIN", "OPERATIONS"]);
    const rows = await tx.$queryRaw<Array<{ id: string; status: string; locked_at: Date | null; import_batch_id: string }>>`
      SELECT id, status::text, locked_at, import_batch_id FROM import_jobs WHERE id = ${jobId} FOR UPDATE
    `;
    const job = rows[0]; const now = new Date();
    if (!job) throw new AdminJobReprocessInvalidError("Job de importação não encontrado.");
    const stale = job.status === "PROCESSING" && job.locked_at && job.locked_at.getTime() < now.getTime() - STALE_MS;
    if (job.status !== "FAILED" && !stale) throw new AdminJobReprocessInvalidError();
    const updated = await tx.importJob.update({ where: { id: jobId }, data: { status: "PENDING", attempts: 0, availableAt: now, lockedAt: null, lockedBy: null, lastError: null, completedAt: null } });
    await tx.importBatch.update({ where: { id: job.import_batch_id }, data: { status: "QUEUED", failureCode: null, startedAt: null, completedAt: null } });
    await recordAdminAudit(tx, { actorUserId: userId, action: "IMPORT_JOB_REPROCESSED", targetType: "ImportJob", targetId: jobId, summary: data.reason, metadata: { importBatchId: job.import_batch_id } });
    return updated;
  });
}

export async function reprocessDeadLetter(userId: string, eventId: string, input: unknown) {
  const data = reprocessInput.parse(input);
  return withUserContext(userId, async (tx) => {
    await assertPlatformAdminInTx(tx, userId, ["SUPER_ADMIN", "OPERATIONS"]);
    const rows = await tx.$queryRaw<Array<{ id: string; status: string; payload_encrypted: string }>>`
      SELECT id, status::text, payload_encrypted FROM outbox_events WHERE id = ${eventId} FOR UPDATE
    `;
    const event = rows[0]; if (!event) throw new AdminJobReprocessInvalidError("Evento de outbox não encontrado.");
    if (event.status !== "DEAD_LETTER" || !event.payload_encrypted) throw new AdminJobReprocessInvalidError("Este evento não possui payload recuperável para reprocessamento.");
    const updated = await tx.outboxEvent.update({ where: { id: eventId }, data: { status: "PENDING", attempts: 0, availableAt: new Date(), lockedAt: null, lockedBy: null, processedAt: null, lastError: null } });
    await recordAdminAudit(tx, { actorUserId: userId, action: "OUTBOX_REPROCESSED", targetType: "OutboxEvent", targetId: eventId, summary: data.reason });
    return updated;
  });
}
