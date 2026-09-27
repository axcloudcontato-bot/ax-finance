import { prisma, type Prisma, type ScheduledJob, type ScheduledJobType } from "@ax-finance/db";

const LOCK_TIMEOUT_MS = 30 * 60 * 1000;
const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000] as const;

const JOB_TYPES = [
  "GENERATE_RECURRENCES",
  "DUE_NOTIFICATIONS",
  "WEEKLY_SUMMARY",
] as const satisfies readonly ScheduledJobType[];

export async function scheduleCompanyJobsInTx(
  tx: Prisma.TransactionClient,
  companyId: string,
  runAsUserId: string,
  now = new Date()
) {
  const nextMonday = new Date(now);
  const daysUntilMonday = ((8 - nextMonday.getUTCDay()) % 7) || 7;
  nextMonday.setUTCDate(nextMonday.getUTCDate() + daysUntilMonday);
  nextMonday.setUTCHours(12, 0, 0, 0);

  await tx.scheduledJob.createMany({
    data: JOB_TYPES.map((type) => ({
      jobKey: `${type}:${companyId}`,
      type,
      companyId,
      runAsUserId,
      nextRunAt: type === "WEEKLY_SUMMARY" ? nextMonday : now,
    })),
    skipDuplicates: true,
  });
}

export async function claimScheduledJobs(workerId: string, requestedLimit = 10) {
  const limit = Math.max(1, Math.min(50, Math.trunc(requestedLimit)));
  return prisma.$transaction(async (tx) => {
    const claimedIds = await tx.$queryRaw<Array<{ id: string }>>`
      WITH candidates AS (
        SELECT "id"
        FROM "scheduled_jobs"
        WHERE "next_run_at" <= (NOW() AT TIME ZONE 'UTC')
          AND (
            "locked_at" IS NULL
            OR "locked_at" < (NOW() AT TIME ZONE 'UTC') - (${LOCK_TIMEOUT_MS} * INTERVAL '1 millisecond')
          )
        ORDER BY "next_run_at" ASC, "type" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT ${limit}
      )
      UPDATE "scheduled_jobs" AS job
      SET
        "locked_at" = (NOW() AT TIME ZONE 'UTC'),
        "locked_by" = ${workerId},
        "updated_at" = (NOW() AT TIME ZONE 'UTC')
      FROM candidates
      WHERE job."id" = candidates."id"
      RETURNING job."id"
    `;
    if (claimedIds.length === 0) return [];
    return tx.scheduledJob.findMany({
      where: { id: { in: claimedIds.map(({ id }) => id) } },
      orderBy: { nextRunAt: "asc" },
    });
  });
}

function nextRunFor(job: Pick<ScheduledJob, "type">, now = new Date()) {
  const next = new Date(now);
  if (job.type === "WEEKLY_SUMMARY") {
    next.setUTCDate(next.getUTCDate() + 7);
  } else {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next;
}

export async function completeScheduledJob(job: ScheduledJob, workerId: string) {
  const now = new Date();
  const result = await prisma.scheduledJob.updateMany({
    where: { id: job.id, lockedBy: workerId },
    data: {
      nextRunAt: nextRunFor(job, now),
      lockedAt: null,
      lockedBy: null,
      lastCompletedAt: now,
      lastError: null,
      attempts: 0,
    },
  });
  return result.count === 1;
}

export async function failScheduledJob(job: ScheduledJob, workerId: string, error: unknown) {
  const attempts = job.attempts + 1;
  const delay = RETRY_DELAYS_MS[Math.min(attempts - 1, RETRY_DELAYS_MS.length - 1)]!;
  const message = (error instanceof Error ? error.message : String(error)).slice(0, 1000);
  const result = await prisma.scheduledJob.updateMany({
    where: { id: job.id, lockedBy: workerId, attempts: job.attempts },
    data: {
      attempts,
      nextRunAt: new Date(Date.now() + delay),
      lockedAt: null,
      lockedBy: null,
      lastError: message,
    },
  });
  return result.count === 1;
}
