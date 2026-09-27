import { getOperationalDiagnostics, readTimestampStatus } from "@ax-finance/domain";
import { json } from "@/lib/api";
import { hasOperationsToken } from "@/lib/operations-auth";

export const dynamic = "force-dynamic";

function safeStoredError(value: string | null) {
  if (!value) return null;
  return /^[A-Za-z][A-Za-z0-9_.-]{0,79}(?::[A-Za-z0-9_.-]{1,80})?$/.test(value)
    ? value
    : "LegacyError";
}

export async function GET(request: Request) {
  if (!hasOperationsToken(request, "OPERATIONS_TOKEN")) {
    return json({ error: "NOT_FOUND" }, 404);
  }
  const now = new Date();
  const [diagnostics, backup, worker] = await Promise.all([
    getOperationalDiagnostics(now),
    readTimestampStatus(process.env.BACKUP_STATUS_FILE || "/data/backups/.last_success", now),
    readTimestampStatus(process.env.WORKER_HEALTH_FILE || "/var/run/ax-finance/worker-heartbeat", now),
  ]);
  const degraded = diagnostics.outbox.deadLetter > 0
    || diagnostics.scheduledJobs.failing > 0
    || diagnostics.scheduledJobs.staleLocks > 0
    || diagnostics.scheduledJobs.overdue > 0
    || diagnostics.importJobs.failed > 0
    || diagnostics.importJobs.staleLocks > 0
    || !backup.available
    || !worker.available;
  return json({
    status: degraded ? "degraded" : "ok",
    checkedAt: now,
    databaseLatencyMs: diagnostics.databaseLatencyMs,
    outbox: diagnostics.outbox,
    scheduledJobs: diagnostics.scheduledJobs,
    importJobs: diagnostics.importJobs,
    backup,
    worker,
    failedJobs: diagnostics.failedJobs.map((job) => ({ ...job, lastError: safeStoredError(job.lastError) })),
    failedImports: diagnostics.failedImports.map((job) => ({ ...job, lastError: safeStoredError(job.lastError) })),
    deadLetters: diagnostics.deadLetters.map((event) => ({ ...event, lastError: safeStoredError(event.lastError) })),
  }, {
    headers: { "Cache-Control": "no-store" },
  });
}
