import { prisma } from "@ax-finance/db";

const MINUTE_MS = 60_000;

export async function getOperationalDiagnostics(now = new Date()) {
  const staleLockBefore = new Date(now.getTime() - 30 * MINUTE_MS);
  const overdueBefore = new Date(now.getTime() - 5 * MINUTE_MS);
  const databaseStartedAt = Date.now();
  await prisma.$queryRaw`SELECT 1`;
  const databaseLatencyMs = Date.now() - databaseStartedAt;

  const [
    outboxPending,
    outboxProcessing,
    outboxProcessed,
    outboxDeadLetter,
    oldestPending,
    scheduledTotal,
    scheduledFailing,
    scheduledStale,
    scheduledOverdue,
    importPending,
    importProcessing,
    importFailed,
    importStale,
    oldestImportPending,
    failedJobs,
    failedImports,
    deadLetters,
  ] = await Promise.all([
    prisma.outboxEvent.count({ where: { status: "PENDING" } }),
    prisma.outboxEvent.count({ where: { status: "PROCESSING" } }),
    prisma.outboxEvent.count({ where: { status: "PROCESSED" } }),
    prisma.outboxEvent.count({ where: { status: "DEAD_LETTER" } }),
    prisma.outboxEvent.findFirst({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
    prisma.scheduledJob.count(),
    prisma.scheduledJob.count({ where: { attempts: { gt: 0 } } }),
    prisma.scheduledJob.count({ where: { lockedAt: { lt: staleLockBefore } } }),
    prisma.scheduledJob.count({ where: { nextRunAt: { lt: overdueBefore }, lockedAt: null } }),
    prisma.importJob.count({ where: { status: "PENDING" } }),
    prisma.importJob.count({ where: { status: "PROCESSING" } }),
    prisma.importJob.count({ where: { status: "FAILED" } }),
    prisma.importJob.count({ where: { status: "PROCESSING", lockedAt: { lt: staleLockBefore } } }),
    prisma.importJob.findFirst({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
    prisma.scheduledJob.findMany({
      where: { attempts: { gt: 0 } },
      orderBy: [{ attempts: "desc" }, { updatedAt: "desc" }],
      take: 50,
      select: {
        id: true,
        type: true,
        attempts: true,
        nextRunAt: true,
        lastCompletedAt: true,
        lastError: true,
        updatedAt: true,
      },
    }),
    prisma.importJob.findMany({
      where: { status: "FAILED" },
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: {
        id: true,
        importBatchId: true,
        attempts: true,
        createdAt: true,
        updatedAt: true,
        lastError: true,
      },
    }),
    prisma.outboxEvent.findMany({
      where: { status: "DEAD_LETTER" },
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: {
        id: true,
        type: true,
        attempts: true,
        createdAt: true,
        updatedAt: true,
        lastError: true,
      },
    }),
  ]);

  return {
    checkedAt: now,
    databaseLatencyMs,
    outbox: {
      pending: outboxPending,
      processing: outboxProcessing,
      processed: outboxProcessed,
      deadLetter: outboxDeadLetter,
      oldestPendingAgeSeconds: oldestPending
        ? Math.max(0, Math.floor((now.getTime() - oldestPending.createdAt.getTime()) / 1000))
        : 0,
    },
    scheduledJobs: {
      total: scheduledTotal,
      failing: scheduledFailing,
      staleLocks: scheduledStale,
      overdue: scheduledOverdue,
    },
    importJobs: {
      pending: importPending,
      processing: importProcessing,
      failed: importFailed,
      staleLocks: importStale,
      oldestPendingAgeSeconds: oldestImportPending
        ? Math.max(0, Math.floor((now.getTime() - oldestImportPending.createdAt.getTime()) / 1000))
        : 0,
    },
    failedJobs,
    failedImports,
    deadLetters,
  };
}
