import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { operationalErrorFingerprint, structuredLog } from "../observability/logger";
import { runOperationalRetention } from "../operations/retention";
import { readTimestampStatus } from "../operations/runtime-status";
import { rootClient, resetDatabase } from "./test-db";

beforeEach(async () => resetDatabase());
afterAll(async () => rootClient.$disconnect());

describe("observabilidade operacional", () => {
  it("registra fingerprint técnica sem persistir a mensagem sensível", () => {
    const error = Object.assign(new Error("Falha para pessoa@empresa.com com token abc"), { code: "ECONNREFUSED" });
    expect(operationalErrorFingerprint(error)).toBe("Error:ECONNREFUSED");
    expect(operationalErrorFingerprint("texto arbitrário")).toBe("UnknownError");
  });

  it("censura campos sensíveis antes de escrever o JSON", () => {
    const output = vi.spyOn(console, "info").mockImplementation(() => undefined);
    try {
      structuredLog("info", "test.redaction", {
        email: "pessoa@empresa.com",
        outboxEventId: "evento-123",
      });
      const payload = JSON.parse(String(output.mock.calls[0]?.[0]));
      expect(payload).toMatchObject({
        event: "test.redaction",
        email: "[redacted]",
        outboxEventId: "evento-123",
      });
    } finally {
      output.mockRestore();
    }
  });

  it("calcula a idade de um heartbeat sem expor seu conteúdo adicional", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "ax-runtime-"));
    const heartbeat = path.join(directory, "heartbeat");
    try {
      await writeFile(heartbeat, "1700000000\nworker-id\n");
      await expect(readTimestampStatus(heartbeat, new Date(1_700_000_125_000))).resolves.toMatchObject({
        available: true,
        ageSeconds: 125,
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("remove outbox operacional expirada e preserva itens pendentes", async () => {
    const now = new Date("2026-09-27T12:00:00.000Z");
    await rootClient.outboxEvent.createMany({
      data: [
        {
          type: "EMAIL_VERIFICATION",
          status: "PROCESSED",
          dedupKey: "retention:processed",
          payloadEncrypted: "",
          processedAt: new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000),
          createdAt: new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000),
        },
        {
          type: "PASSWORD_RESET",
          status: "DEAD_LETTER",
          dedupKey: "retention:dead-letter",
          payloadEncrypted: "encrypted",
          updatedAt: new Date(now.getTime() - 91 * 24 * 60 * 60 * 1000),
        },
        {
          type: "PASSWORD_RESET",
          status: "PENDING",
          dedupKey: "retention:pending",
          payloadEncrypted: "encrypted",
          createdAt: new Date(now.getTime() - 120 * 24 * 60 * 60 * 1000),
        },
      ],
    });

    const result = await runOperationalRetention(now);
    expect(result).toMatchObject({ processedOutbox: 1, deadLetters: 1 });
    expect(await rootClient.outboxEvent.findMany({ select: { dedupKey: true } })).toEqual([
      { dedupKey: "retention:pending" },
    ]);
  });
});
