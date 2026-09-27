import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createPrismaClient } from "@ax-finance/db";
import {
  decodeOutboxEmailPayload,
  confirmBankImport,
  createBankImportPreview,
  createCompany,
  createCompanyInvitation,
  createFinancialAccount,
  importStorageKey,
  generateSubscriptionNotifications,
  listBankStatementLines,
  registerUser,
  requestPasswordReset,
  writeImportSource,
  type OutboxEmailPayload,
} from "@ax-finance/domain";
import { processImportJobsBatch, processOutboxBatch } from "./processor";

const rootClient = createPrismaClient(process.env.DATABASE_URL!);

beforeEach(async () => {
  await rootClient.$executeRawUnsafe(
    'TRUNCATE TABLE "outbox_events", "account_tokens", "sessions", "users" RESTART IDENTITY CASCADE'
  );
});
afterAll(async () => rootClient.$disconnect());

describe("worker de outbox", () => {
  it("entrega o payload ao handler e confirma o evento", async () => {
    const user = await registerUser({
      email: `worker.${randomUUID()}@teste.ax.finance`,
      name: "Worker",
      password: "senha-forte-123",
    });
    await requestPasswordReset(user.email, { baseUrl: "https://financeiro.example.com" });
    let received: OutboxEmailPayload | undefined;

    const result = await processOutboxBatch("worker-teste", 10, async (event) => {
      received = decodeOutboxEmailPayload(event);
    });

    expect(result).toEqual({ claimed: 1, processed: 1, failed: 0 });
    expect(received).toMatchObject({ to: user.email, baseUrl: "https://financeiro.example.com" });
    expect(await rootClient.outboxEvent.findFirstOrThrow()).toMatchObject({
      status: "PROCESSED",
      payloadEncrypted: "",
    });
  });

  it("renderiza o e-mail real e simula a entrega quando SMTP não está configurado em teste", async () => {
    const user = await registerUser({
      email: `worker-email.${randomUUID()}@teste.ax.finance`,
      name: "E-mail Worker",
      password: "senha-forte-123",
    });
    await requestPasswordReset(user.email, { baseUrl: "https://financeiro.example.com" });

    await expect(processOutboxBatch("worker-email", 10)).resolves.toEqual({
      claimed: 1,
      processed: 1,
      failed: 0,
    });
    expect(await rootClient.outboxEvent.findFirstOrThrow()).toMatchObject({ status: "PROCESSED" });
  });

  it("entrega convites e avisos de assinatura pela mesma outbox", async () => {
    const owner = await registerUser({
      email: `worker-transactional.${randomUUID()}@teste.ax.finance`,
      name: "Proprietária",
      password: "senha-forte-123",
    });
    const company = await createCompany(owner.id, { name: "Empresa Transacional" });
    await createCompanyInvitation(owner.id, company.id, {
      email: `convidado.${randomUUID()}@teste.ax.finance`,
      role: "VIEWER",
    });
    const now = new Date("2026-09-27T12:00:00.000Z");
    await rootClient.subscription.update({
      where: { companyId: company.id },
      data: { trialEndsAt: new Date("2026-09-30T12:00:00.000Z") },
    });
    await generateSubscriptionNotifications(owner.id, company.id, now);

    await expect(processOutboxBatch("worker-transactional", 10)).resolves.toEqual({
      claimed: 2,
      processed: 2,
      failed: 0,
    });
    expect(await rootClient.outboxEvent.count({ where: { status: "PROCESSED" } })).toBe(2);
  });
});

describe("worker de importação", () => {
  it("processa a fonte privada, conclui a fila e remove o arquivo temporário", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "ax-import-worker-"));
    const previousImportsDir = process.env.IMPORTS_DIR;
    process.env.IMPORTS_DIR = directory;
    try {
      const user = await registerUser({
        email: `worker-import.${randomUUID()}@teste.ax.finance`,
        name: "Worker Import",
        password: "senha-forte-123",
      });
      const company = await createCompany(user.id, { name: "Empresa Import" });
      const account = await createFinancialAccount(user.id, company.id, {
        name: "Banco",
        type: "BANK",
        openingBalanceCents: 0,
        openingDate: "2026-01-01",
      });
      const batchId = randomUUID();
      const content = "Data;Descrição;Valor\n27/09/2026;Recebimento;150,25\n";
      const storageKey = importStorageKey(company.id, batchId, "CSV");
      await writeImportSource(storageKey, Buffer.from(content));
      await createBankImportPreview(user.id, company.id, {
        id: batchId,
        financialAccountId: account.id,
        fileName: "extrato.csv",
        fileFormat: "CSV",
        fileSizeBytes: Buffer.byteLength(content),
        storageKey,
        detectedRowCount: 1,
      });
      await confirmBankImport(user.id, company.id, batchId, {
        processInBackground: true,
        mapping: { dateColumn: "Data", descriptionColumn: "Descrição", amountColumn: "Valor" },
      });

      await expect(processImportJobsBatch("worker-import-test", 1)).resolves.toEqual({
        claimed: 1,
        processed: 1,
        failed: 0,
      });
      expect(await rootClient.importJob.findUniqueOrThrow({ where: { importBatchId: batchId } }))
        .toMatchObject({ status: "COMPLETED" });
      expect(await listBankStatementLines(user.id, company.id, { financialAccountId: account.id }))
        .toMatchObject([{ amountCents: 15_025n }]);
    } finally {
      if (previousImportsDir === undefined) delete process.env.IMPORTS_DIR;
      else process.env.IMPORTS_DIR = previousImportsDir;
      await rm(directory, { recursive: true, force: true });
    }
  });
});
