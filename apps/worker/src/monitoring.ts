import {
  getOperationalDiagnostics,
  logOperationalError,
  readTimestampStatus,
  structuredLog,
} from "@ax-finance/domain";

const lastAlertAt = new Map<string, number>();

type AlertDeliveryOptions = {
  bypassCooldown?: boolean;
  requireWebhook?: boolean;
  test?: boolean;
};

export type AlertDeliveryResult = "delivered" | "logged" | "cooldown";

function positiveNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function deliverAlert(
  code: string,
  summary: string,
  value: number,
  now: Date,
  options: AlertDeliveryOptions = {}
): Promise<AlertDeliveryResult> {
  const cooldownMs = positiveNumber(process.env.ALERT_COOLDOWN_MINUTES, 30) * 60_000;
  const previous = lastAlertAt.get(code) || 0;
  if (!options.bypassCooldown && now.getTime() - previous < cooldownMs) return "cooldown";

  structuredLog("warn", "operations.alert", { alertCode: code, summary, value });
  const webhook = process.env.ALERT_WEBHOOK_URL?.trim();
  if (!webhook) {
    if (options.requireWebhook) {
      throw new Error("ALERT_WEBHOOK_URL não está configurada.");
    }
    lastAlertAt.set(code, now.getTime());
    return "logged";
  }
  try {
    const response = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service: "ax-finance",
        environment: process.env.DEPLOY_ENVIRONMENT || "production",
        alertCode: code,
        summary,
        value,
        timestamp: now.toISOString(),
        test: options.test || undefined,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw Object.assign(new Error("AlertWebhookRejected"), { code: `HTTP_${response.status}` });
    lastAlertAt.set(code, now.getTime());
    return "delivered";
  } catch (error) {
    logOperationalError("operations.alert_delivery_failed", error, { alertCode: code });
    if (options.requireWebhook) throw error;
    return "logged";
  }
}

export async function testAlertWebhook(now = new Date()) {
  return deliverAlert(
    "operational_test",
    "Teste operacional do canal de alertas do AX Finance.",
    1,
    now,
    { bypassCooldown: true, requireWebhook: true, test: true }
  );
}

export async function monitorOperations(now = new Date()) {
  const diagnostics = await getOperationalDiagnostics(now);
  const backup = await readTimestampStatus(
    process.env.BACKUP_STATUS_FILE || "/data/backups/.last_success",
    now
  );
  const oldestPendingLimit = positiveNumber(process.env.ALERT_OUTBOX_PENDING_SECONDS, 900);
  const oldestImportLimit = positiveNumber(process.env.ALERT_IMPORT_PENDING_SECONDS, 1800);
  const backupMaxAge = positiveNumber(process.env.BACKUP_MAX_AGE_SECONDS, 129_600);

  if (diagnostics.outbox.deadLetter > 0) {
    await deliverAlert("outbox_dead_letter", "Existem eventos em dead letter.", diagnostics.outbox.deadLetter, now);
  }
  if (diagnostics.outbox.oldestPendingAgeSeconds > oldestPendingLimit) {
    await deliverAlert(
      "outbox_pending_too_old",
      "O evento pendente mais antigo excedeu o limite.",
      diagnostics.outbox.oldestPendingAgeSeconds,
      now
    );
  }
  if (diagnostics.scheduledJobs.failing > 0) {
    await deliverAlert("scheduled_jobs_failing", "Existem jobs agendados com falha.", diagnostics.scheduledJobs.failing, now);
  }
  if (diagnostics.scheduledJobs.staleLocks > 0) {
    await deliverAlert("scheduled_jobs_stale_lock", "Existem locks de jobs expirados.", diagnostics.scheduledJobs.staleLocks, now);
  }
  if (diagnostics.scheduledJobs.overdue > 0) {
    await deliverAlert("scheduled_jobs_overdue", "Existem jobs agendados atrasados.", diagnostics.scheduledJobs.overdue, now);
  }
  if (diagnostics.importJobs.failed > 0) {
    await deliverAlert("import_jobs_failed", "Existem importações com falha definitiva.", diagnostics.importJobs.failed, now);
  }
  if (diagnostics.importJobs.staleLocks > 0) {
    await deliverAlert("import_jobs_stale_lock", "Existem importações com lock expirado.", diagnostics.importJobs.staleLocks, now);
  }
  if (diagnostics.importJobs.oldestPendingAgeSeconds > oldestImportLimit) {
    await deliverAlert(
      "import_jobs_pending_too_old",
      "A importação pendente mais antiga excedeu o limite.",
      diagnostics.importJobs.oldestPendingAgeSeconds,
      now
    );
  }
  if (process.uptime() > 15 * 60 && (!backup.available || (backup.ageSeconds ?? Infinity) > backupMaxAge)) {
    await deliverAlert("backup_stale", "O backup automático está ausente ou vencido.", backup.ageSeconds ?? -1, now);
  }
  if (process.uptime() > 30 * 60 && process.env.RESTORE_DRILL_STATUS_FILE) {
    const restore = await readTimestampStatus(process.env.RESTORE_DRILL_STATUS_FILE, now);
    const failure = await readTimestampStatus(process.env.RESTORE_DRILL_FAILURE_FILE || "/data/restore/.last_failure", now);
    if (failure.available) await deliverAlert("restore_drill_failed", "O ensaio de restauração falhou; confira a evidência operacional.", failure.ageSeconds ?? 0, now);
    else if (!restore.available || (restore.ageSeconds ?? Infinity) > positiveNumber(process.env.RESTORE_DRILL_MAX_AGE_SECONDS, 691200)) {
      await deliverAlert("restore_drill_stale", "Não há ensaio recente de restauração aprovado.", restore.ageSeconds ?? -1, now);
    }
  }
  if (process.uptime() > 30 * 60 && process.env.EXTERNAL_BACKUP_REQUIRED === "true") {
    const external = await readTimestampStatus(process.env.BACKUP_COPY_STATUS_FILE || "/data/backups/.external_copy_success", now);
    if (!external.available || (external.ageSeconds ?? Infinity) > backupMaxAge) {
      await deliverAlert("external_backup_stale", "A cópia externa do backup está ausente ou vencida.", external.ageSeconds ?? -1, now);
    }
  }

  return { diagnostics, backup };
}
