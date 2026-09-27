import { prisma } from "@ax-finance/db";

const DAY_MS = 24 * 60 * 60 * 1000;

function positiveDays(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export async function runOperationalRetention(now = new Date()) {
  const processedOutboxDays = positiveDays(process.env.RETENTION_PROCESSED_OUTBOX_DAYS, 30);
  const deadLetterDays = positiveDays(process.env.RETENTION_DEAD_LETTER_DAYS, 90);
  const identityArtifactDays = positiveDays(process.env.RETENTION_IDENTITY_ARTIFACT_DAYS, 30);
  const completedImportJobDays = positiveDays(process.env.RETENTION_COMPLETED_IMPORT_JOB_DAYS, 30);
  const failedImportJobDays = positiveDays(process.env.RETENTION_FAILED_IMPORT_JOB_DAYS, 90);
  const identityCutoff = new Date(now.getTime() - identityArtifactDays * DAY_MS);

  const [
    processedOutbox,
    deadLetters,
    completedImportJobs,
    failedImportJobs,
    sessions,
    accountTokens,
    mfaChallenges,
    loginRateLimits,
  ] = await prisma.$transaction([
    prisma.outboxEvent.deleteMany({
      where: {
        status: "PROCESSED",
        processedAt: { lt: new Date(now.getTime() - processedOutboxDays * DAY_MS) },
      },
    }),
    prisma.outboxEvent.deleteMany({
      where: {
        status: "DEAD_LETTER",
        updatedAt: { lt: new Date(now.getTime() - deadLetterDays * DAY_MS) },
      },
    }),
    prisma.importJob.deleteMany({
      where: {
        status: "COMPLETED",
        completedAt: { lt: new Date(now.getTime() - completedImportJobDays * DAY_MS) },
      },
    }),
    prisma.importJob.deleteMany({
      where: {
        status: "FAILED",
        completedAt: { lt: new Date(now.getTime() - failedImportJobDays * DAY_MS) },
      },
    }),
    prisma.session.deleteMany({ where: { expiresAt: { lt: identityCutoff } } }),
    prisma.accountToken.deleteMany({ where: { expiresAt: { lt: identityCutoff } } }),
    prisma.mfaChallenge.deleteMany({ where: { expiresAt: { lt: identityCutoff } } }),
    prisma.loginRateLimit.deleteMany({ where: { updatedAt: { lt: identityCutoff } } }),
  ]);

  return {
    processedOutbox: processedOutbox.count,
    deadLetters: deadLetters.count,
    completedImportJobs: completedImportJobs.count,
    failedImportJobs: failedImportJobs.count,
    sessions: sessions.count,
    accountTokens: accountTokens.count,
    mfaChallenges: mfaChallenges.count,
    loginRateLimits: loginRateLimits.count,
  };
}
