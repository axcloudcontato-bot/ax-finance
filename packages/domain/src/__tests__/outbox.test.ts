import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { registerUser } from "../identity/register";
import { requestPasswordReset } from "../identity/account-tokens";
import {
  claimOutboxEvents,
  completeOutboxEvent,
  decodeOutboxEmailPayload,
  failOutboxEvent,
} from "../outbox/events";
import { rootClient, resetDatabase } from "./test-db";

function uniqueEmail(label: string) {
  return `${label}.${randomUUID()}@teste.ax.finance`;
}

beforeEach(async () => resetDatabase());
afterAll(async () => rootClient.$disconnect());

describe("outbox transacional", () => {
  it("grava cadastro, token e e-mail cifrado na mesma transação", async () => {
    const email = uniqueEmail("signup");
    const user = await registerUser(
      { email, name: "Cadastro Outbox", password: "senha-forte-123" },
      {
        requireEmailVerification: true,
        verificationDelivery: { baseUrl: "https://financeiro.example.com" },
      }
    );

    expect(user.verification?.queued).toBe(true);
    const event = await rootClient.outboxEvent.findFirstOrThrow();
    expect(event.status).toBe("PENDING");
    expect(event.payloadEncrypted).not.toContain(email);
    expect(event.payloadEncrypted).not.toContain(user.verification!.rawToken);
    expect(decodeOutboxEmailPayload(event)).toMatchObject({
      to: email,
      rawToken: user.verification!.rawToken,
      baseUrl: "https://financeiro.example.com",
    });
    expect(await rootClient.accountToken.count({ where: { userId: user.id } })).toBe(1);
  });

  it("desfaz o cadastro inteiro quando o evento não pode ser criado", async () => {
    const email = uniqueEmail("rollback");
    await expect(registerUser(
      { email, name: "Rollback", password: "senha-forte-123" },
      {
        requireEmailVerification: true,
        verificationDelivery: { baseUrl: "javascript:invalido" },
      }
    )).rejects.toBeTruthy();
    expect(await rootClient.user.findUnique({ where: { email } })).toBeNull();
    expect(await rootClient.outboxEvent.count()).toBe(0);
  });

  it("um evento só pode ser reivindicado por um worker e remove o payload ao concluir", async () => {
    const user = await registerUser({ email: uniqueEmail("claim"), name: "Claim", password: "senha-forte-123" });
    await requestPasswordReset(user.email, { baseUrl: "https://financeiro.example.com" });

    const [first, second] = await Promise.all([
      claimOutboxEvents("worker-a", 10),
      claimOutboxEvents("worker-b", 10),
    ]);
    expect(first.length + second.length).toBe(1);
    const claimed = first[0] ?? second[0]!;
    const owner = first.length ? "worker-a" : "worker-b";
    expect(await completeOutboxEvent(claimed.id, owner)).toBe(true);
    const completed = await rootClient.outboxEvent.findUniqueOrThrow({ where: { id: claimed.id } });
    expect(completed).toMatchObject({ status: "PROCESSED", payloadEncrypted: "", lockedBy: null });
  });

  it("aplica retentativa com atraso e envia para dead letter após cinco falhas", async () => {
    const user = await registerUser({ email: uniqueEmail("retry"), name: "Retry", password: "senha-forte-123" });
    await requestPasswordReset(user.email, { baseUrl: "https://financeiro.example.com" });

    let eventId = "";
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const workerId = `worker-${attempt}`;
      const [event] = await claimOutboxEvents(workerId, 1);
      expect(event).toBeDefined();
      eventId = event!.id;
      await failOutboxEvent(eventId, workerId, new Error("SMTP indisponível"));
      const failed = await rootClient.outboxEvent.findUniqueOrThrow({ where: { id: eventId } });
      expect(failed.attempts).toBe(attempt);
      expect(failed.status).toBe(attempt === 5 ? "DEAD_LETTER" : "PENDING");
      if (attempt < 5) {
        expect(await claimOutboxEvents("worker-imediato", 1)).toHaveLength(0);
        await rootClient.outboxEvent.update({
          where: { id: eventId },
          data: { availableAt: new Date(0) },
        });
      }
    }
    const lastError = (await rootClient.outboxEvent.findUniqueOrThrow({ where: { id: eventId } })).lastError;
    expect(lastError).toMatch(/^Error:sha256_[a-f0-9]{12}$/);
    expect(lastError).not.toContain("SMTP indisponível");
  });
});
