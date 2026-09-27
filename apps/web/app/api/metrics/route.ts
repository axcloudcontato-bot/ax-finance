import { getOperationalDiagnostics, readTimestampStatus } from "@ax-finance/domain";
import { hasOperationsToken } from "@/lib/operations-auth";

export const dynamic = "force-dynamic";

function metric(name: string, value: number, labels = "") {
  return `${name}${labels ? `{${labels}}` : ""} ${Number.isFinite(value) ? value : 0}`;
}

export async function GET(request: Request) {
  if (!hasOperationsToken(request, "METRICS_TOKEN")) {
    return new Response("Not found\n", { status: 404 });
  }

  try {
    const now = new Date();
    const [diagnostics, backup, worker] = await Promise.all([
      getOperationalDiagnostics(now),
      readTimestampStatus(process.env.BACKUP_STATUS_FILE || "/data/backups/.last_success", now),
      readTimestampStatus(process.env.WORKER_HEALTH_FILE || "/var/run/ax-finance/worker-heartbeat", now),
    ]);
    const lines = [
      "# HELP ax_finance_up Application operational query succeeded.",
      "# TYPE ax_finance_up gauge",
      metric("ax_finance_up", 1),
      "# TYPE ax_finance_database_query_duration_seconds gauge",
      metric("ax_finance_database_query_duration_seconds", diagnostics.databaseLatencyMs / 1000),
      "# TYPE ax_finance_outbox_events gauge",
      metric("ax_finance_outbox_events", diagnostics.outbox.pending, 'status="pending"'),
      metric("ax_finance_outbox_events", diagnostics.outbox.processing, 'status="processing"'),
      metric("ax_finance_outbox_events", diagnostics.outbox.processed, 'status="processed"'),
      metric("ax_finance_outbox_events", diagnostics.outbox.deadLetter, 'status="dead_letter"'),
      "# TYPE ax_finance_outbox_oldest_pending_age_seconds gauge",
      metric("ax_finance_outbox_oldest_pending_age_seconds", diagnostics.outbox.oldestPendingAgeSeconds),
      "# TYPE ax_finance_scheduled_jobs gauge",
      metric("ax_finance_scheduled_jobs", diagnostics.scheduledJobs.total, 'state="total"'),
      metric("ax_finance_scheduled_jobs", diagnostics.scheduledJobs.failing, 'state="failing"'),
      metric("ax_finance_scheduled_jobs", diagnostics.scheduledJobs.staleLocks, 'state="stale_lock"'),
      metric("ax_finance_scheduled_jobs", diagnostics.scheduledJobs.overdue, 'state="overdue"'),
      "# TYPE ax_finance_import_jobs gauge",
      metric("ax_finance_import_jobs", diagnostics.importJobs.pending, 'state="pending"'),
      metric("ax_finance_import_jobs", diagnostics.importJobs.processing, 'state="processing"'),
      metric("ax_finance_import_jobs", diagnostics.importJobs.failed, 'state="failed"'),
      metric("ax_finance_import_jobs", diagnostics.importJobs.staleLocks, 'state="stale_lock"'),
      "# TYPE ax_finance_import_oldest_pending_age_seconds gauge",
      metric("ax_finance_import_oldest_pending_age_seconds", diagnostics.importJobs.oldestPendingAgeSeconds),
      "# TYPE ax_finance_backup_age_seconds gauge",
      metric("ax_finance_backup_age_seconds", backup.ageSeconds ?? -1),
      "# TYPE ax_finance_backup_last_success_timestamp_seconds gauge",
      metric("ax_finance_backup_last_success_timestamp_seconds", backup.timestamp ? backup.timestamp.getTime() / 1000 : 0),
      "# TYPE ax_finance_worker_heartbeat_age_seconds gauge",
      metric("ax_finance_worker_heartbeat_age_seconds", worker.ageSeconds ?? -1),
      "",
    ];
    return new Response(lines.join("\n"), {
      headers: {
        "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new Response(`${metric("ax_finance_up", 0)}\n`, {
      status: 503,
      headers: {
        "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }
}
