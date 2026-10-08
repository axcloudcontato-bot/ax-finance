import type { ImportJob, Prisma } from "@ax-finance/db";
import { prisma, withCompanyContext } from "@ax-finance/db";
import { z } from "zod";
import { assertActiveMembership } from "../companies/assert-membership";
import { assertCompanyPermission } from "../companies/permissions";
import {
  FinancialAccountNotFoundError,
  ImportBatchInvalidStateError,
  ImportBatchNotFoundError,
} from "../errors";
import { operationalErrorFingerprint } from "../observability/logger";
import { enqueueImportFailedEmail } from "../outbox/events";
import {
  csvColumnMappingSchema,
  parseBankStatementContent,
  type CsvColumnMapping,
  type ImportFileFormatValue,
} from "./bank-statement-parser";
import { assertCompanyPlanFeature } from "../subscriptions/plan-features";
import { OPERATIONAL_ACCOUNT } from "../financial-accounts/operational";

const LOCK_TIMEOUT_MS = 30 * 60 * 1000;
const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [60_000, 5 * 60_000] as const;

const createPreviewInput = z.object({
  id: z.string().uuid(),
  financialAccountId: z.string().uuid(),
  fileName: z.string().trim().min(1).max(255),
  fileFormat: z.enum(["CSV", "OFX"]),
  fileSizeBytes: z.number().int().positive().max(20 * 1024 * 1024),
  storageKey: z.string().regex(/^[a-f0-9-]{36}\/[a-f0-9-]{36}\/source\.(csv|ofx)$/),
  detectedRowCount: z.number().int().min(0).max(100_000),
});

const confirmInput = z.object({
  processInBackground: z.boolean(),
  mapping: csvColumnMappingSchema.optional(),
});

export async function createBankImportPreview(
  userId: string,
  companyId: string,
  input: unknown
) {
  const data = createPreviewInput.parse(input);
  await assertCompanyPermission(userId, companyId, "FINANCE_WRITE");
  await assertCompanyPlanFeature(userId, companyId, "BANK_RECONCILIATION");
  return withCompanyContext(userId, companyId, async (tx) => {
    const account = await tx.financialAccount.findFirst({
      where: { id: data.financialAccountId, companyId, status: "ACTIVE", ...OPERATIONAL_ACCOUNT },
      select: { id: true },
    });
    if (!account) throw new FinancialAccountNotFoundError();
    return tx.importBatch.create({
      data: {
        id: data.id,
        companyId,
        financialAccountId: data.financialAccountId,
        fileName: data.fileName,
        fileFormat: data.fileFormat,
        fileSizeBytes: data.fileSizeBytes,
        storageKey: data.storageKey,
        requestedByUserId: userId,
        status: "PREVIEW",
        rowCount: data.detectedRowCount,
      },
    });
  });
}

export async function getBankImportBatch(userId: string, companyId: string, batchId: string) {
  await assertActiveMembership(userId, companyId);
  await assertCompanyPlanFeature(userId, companyId, "BANK_RECONCILIATION");
  const batch = await withCompanyContext(userId, companyId, (tx) => tx.importBatch.findFirst({
    where: { id: batchId, companyId },
    include: { financialAccount: { select: { name: true } }, job: true },
  }));
  if (!batch) throw new ImportBatchNotFoundError();
  return batch;
}

export async function confirmBankImport(
  userId: string,
  companyId: string,
  batchId: string,
  input: unknown
) {
  const data = confirmInput.parse(input);
  await assertCompanyPermission(userId, companyId, "FINANCE_WRITE");
  await assertCompanyPlanFeature(userId, companyId, "BANK_RECONCILIATION");
  return withCompanyContext(userId, companyId, async (tx) => {
    const batch = await tx.importBatch.findFirst({ where: { id: batchId, companyId } });
    if (!batch) throw new ImportBatchNotFoundError();
    if (batch.status !== "PREVIEW" || !batch.storageKey) throw new ImportBatchInvalidStateError();
    const mapping: CsvColumnMapping | undefined = batch.fileFormat === "CSV"
      ? csvColumnMappingSchema.parse(data.mapping)
      : undefined;
    const updated = await tx.importBatch.update({
      where: { id: batch.id },
      data: {
        status: data.processInBackground ? "QUEUED" : "PROCESSING",
        columnMapping: mapping ? mapping as Prisma.InputJsonValue : undefined,
        startedAt: data.processInBackground ? null : new Date(),
        failureCode: null,
      },
    });
    if (data.processInBackground) {
      await tx.importJob.create({
        data: { importBatchId: batch.id, companyId, runAsUserId: userId },
      });
    }
    return updated;
  });
}

export async function setBankImportProcessing(userId: string, companyId: string, batchId: string) {
  await assertActiveMembership(userId, companyId);
  await assertCompanyPlanFeature(userId, companyId, "BANK_RECONCILIATION");
  return withCompanyContext(userId, companyId, (tx) => tx.importBatch.updateMany({
    where: { id: batchId, companyId, status: { in: ["QUEUED", "PROCESSING"] } },
    data: { status: "PROCESSING", startedAt: new Date(), failureCode: null },
  }));
}

export async function processBankImportBatch(
  userId: string,
  companyId: string,
  batchId: string,
  content: string
) {
  await assertCompanyPermission(userId, companyId, "FINANCE_WRITE");
  await assertCompanyPlanFeature(userId, companyId, "BANK_RECONCILIATION");
  const batch = await getBankImportBatch(userId, companyId, batchId);
  if (batch.status === "COMPLETED") return batch;
  if (!["PREVIEW", "PROCESSING", "QUEUED"].includes(batch.status)) throw new ImportBatchInvalidStateError();
  const parsed = parseBankStatementContent(
    batch.fileFormat as ImportFileFormatValue,
    content,
    batch.columnMapping || undefined
  );

  return withCompanyContext(userId, companyId, async (tx) => {
    const current = await tx.importBatch.findFirst({
      where: { id: batchId, companyId },
      include: { job: { select: { id: true } } },
    });
    if (!current) throw new ImportBatchNotFoundError();
    if (current.status === "COMPLETED") return current;
    const inserted = await tx.bankStatementLine.createMany({
      data: parsed.rows.map((row) => ({
        companyId,
        financialAccountId: current.financialAccountId,
        importBatchId: current.id,
        lineDate: new Date(`${row.lineDate}T00:00:00Z`),
        description: row.description,
        amountCents: row.amountCents,
        dedupKey: row.dedupKey,
      })),
      skipDuplicates: true,
    });
    const completed = await tx.importBatch.update({
      where: { id: current.id },
      data: {
        status: "COMPLETED",
        rowCount: parsed.totalRows,
        importedCount: inserted.count,
        duplicateCount: parsed.rows.length - inserted.count,
        invalidCount: parsed.invalidRows.length,
        completedAt: new Date(),
        failureCode: null,
      },
    });
    if (current.job && current.requestedByUserId) {
      await tx.notification.createMany({
        data: [{
          companyId,
          userId: current.requestedByUserId,
          type: "IMPORT_COMPLETED",
          dedupKey: `import-completed:${current.id}:${current.requestedByUserId}`,
          title: "Importação concluída",
          body: `${inserted.count} linha(s) foram adicionadas à conciliação.`,
          href: `/conciliacao?conta=${current.financialAccountId}`,
        }],
        skipDuplicates: true,
      });
    }
    return completed;
  });
}

export async function markBankImportFailed(
  userId: string,
  companyId: string,
  batchId: string,
  error: unknown
) {
  const failureCode = operationalErrorFingerprint(error);
  return withCompanyContext(userId, companyId, async (tx) => {
    const batch = await tx.importBatch.findFirst({ where: { id: batchId, companyId } });
    if (!batch) throw new ImportBatchNotFoundError();
    const failed = await tx.importBatch.update({
      where: { id: batch.id },
      data: { status: "FAILED", failureCode, completedAt: new Date() },
    });
    if (batch.requestedByUserId) {
      await tx.notification.createMany({
        data: [{
          companyId,
          userId: batch.requestedByUserId,
          type: "IMPORT_FAILED",
          dedupKey: `import-failed:${batch.id}:${batch.requestedByUserId}`,
          title: "Falha na importação",
          body: "O arquivo não pôde ser processado. Revise o formato e tente novamente.",
          href: `/conciliacao?conta=${batch.financialAccountId}`,
        }],
        skipDuplicates: true,
      });
      const [requester, company] = await Promise.all([
        tx.user.findUnique({ where: { id: batch.requestedByUserId } }),
        tx.company.findUnique({ where: { id: companyId } }),
      ]);
      if (requester && company) {
        await enqueueImportFailedEmail(tx, `import-failed-email:${batch.id}:${requester.id}`, {
          to: requester.email,
          name: requester.name,
          companyName: company.name,
        });
      }
    }
    return failed;
  });
}

export async function clearBankImportStorageKey(userId: string, companyId: string, batchId: string) {
  return withCompanyContext(userId, companyId, (tx) => tx.importBatch.updateMany({
    where: { id: batchId, companyId },
    data: { storageKey: null },
  }));
}

export async function claimImportJobs(workerId: string, requestedLimit = 5) {
  const limit = Math.max(1, Math.min(20, Math.trunc(requestedLimit)));
  return prisma.$transaction(async (tx) => {
    const claimedIds = await tx.$queryRaw<Array<{ id: string }>>`
      WITH candidates AS (
        SELECT "id"
        FROM "import_jobs"
        WHERE
          ("status" = 'PENDING' AND "available_at" <= (NOW() AT TIME ZONE 'UTC'))
          OR (
            "status" = 'PROCESSING'
            AND "locked_at" < (NOW() AT TIME ZONE 'UTC') - (${LOCK_TIMEOUT_MS} * INTERVAL '1 millisecond')
          )
        ORDER BY "created_at" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT ${limit}
      )
      UPDATE "import_jobs" AS job
      SET "status" = 'PROCESSING', "locked_at" = (NOW() AT TIME ZONE 'UTC'),
          "locked_by" = ${workerId}, "updated_at" = (NOW() AT TIME ZONE 'UTC')
      FROM candidates
      WHERE job."id" = candidates."id"
      RETURNING job."id"
    `;
    if (claimedIds.length === 0) return [];
    return tx.importJob.findMany({
      where: { id: { in: claimedIds.map(({ id }) => id) } },
      orderBy: { createdAt: "asc" },
    });
  });
}

export async function completeImportJob(job: ImportJob, workerId: string) {
  const result = await prisma.importJob.updateMany({
    where: { id: job.id, status: "PROCESSING", lockedBy: workerId },
    data: { status: "COMPLETED", lockedAt: null, lockedBy: null, lastError: null, completedAt: new Date() },
  });
  return result.count === 1;
}

export async function failImportJob(job: ImportJob, workerId: string, error: unknown) {
  const attempts = job.attempts + 1;
  const finalFailure = attempts >= MAX_ATTEMPTS;
  const delay = RETRY_DELAYS_MS[Math.min(attempts - 1, RETRY_DELAYS_MS.length - 1)]!;
  const failureCode = operationalErrorFingerprint(error);
  const result = await prisma.importJob.updateMany({
    where: { id: job.id, status: "PROCESSING", lockedBy: workerId, attempts: job.attempts },
    data: {
      status: finalFailure ? "FAILED" : "PENDING",
      attempts,
      availableAt: finalFailure ? job.availableAt : new Date(Date.now() + delay),
      lockedAt: null,
      lockedBy: null,
      lastError: failureCode,
      completedAt: finalFailure ? new Date() : null,
    },
  });
  if (result.count !== 1) return { updated: false, finalFailure: false };
  if (finalFailure) await markBankImportFailed(job.runAsUserId, job.companyId, job.importBatchId, error);
  else await withCompanyContext(job.runAsUserId, job.companyId, (tx) => tx.importBatch.updateMany({
    where: { id: job.importBatchId, companyId: job.companyId },
    data: { status: "QUEUED", failureCode },
  }));
  return { updated: true, finalFailure };
}
