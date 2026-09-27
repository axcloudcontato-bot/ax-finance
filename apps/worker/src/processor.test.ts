import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createPrismaClient } from "@ax-finance/db";
import {
  decodeOutboxEmailPayload,
  registerUser,
  requestPasswordReset,
  type OutboxEmailPayload,
} from "@ax-finance/domain";
import { processOutboxBatch } from "./processor";

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
});
