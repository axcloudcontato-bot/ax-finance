import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { prisma, type OutboxEvent, type OutboxEventType, type Prisma } from "@ax-finance/db";
import { z } from "zod";
import { OutboxConfigurationError } from "../errors";

const LOCK_TIMEOUT_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000] as const;

const emailPayloadSchema = z.object({
  to: z.string().email(),
  name: z.string().min(1).max(200),
  rawToken: z.string().regex(/^[a-f0-9]{64}$/i),
  baseUrl: z.string().url().refine((value) => value.startsWith("http://") || value.startsWith("https://")),
  returnTo: z.string().startsWith("/convites/").optional(),
});

const deliveryBaseSchema = z.object({
  to: z.string().email(),
  name: z.string().min(1).max(200),
  companyName: z.string().min(1).max(200),
  baseUrl: z.string().url().refine((value) => value.startsWith("http://") || value.startsWith("https://")),
});

const dueDateSummaryPayloadSchema = deliveryBaseSchema.extend({
  items: z.array(z.object({
    type: z.enum(["RECEIVABLE", "PAYABLE"]),
    description: z.string().min(1).max(500),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    overdue: z.boolean(),
    href: z.string().startsWith("/"),
  })).min(1).max(50),
});

const weeklySummaryPayloadSchema = deliveryBaseSchema.extend({
  receivableOpenCents: z.string().regex(/^\d+$/),
  payableOpenCents: z.string().regex(/^\d+$/),
  overdueCount: z.number().int().nonnegative(),
  dueNext7Count: z.number().int().nonnegative(),
});

export type OutboxEmailPayload = z.infer<typeof emailPayloadSchema>;
export type DueDateSummaryPayload = z.infer<typeof dueDateSummaryPayloadSchema>;
export type WeeklySummaryPayload = z.infer<typeof weeklySummaryPayloadSchema>;

function encryptionKey(): Buffer {
  const configured = process.env.OUTBOX_ENCRYPTION_KEY?.trim() || process.env.SESSION_SECRET?.trim();
  if (!configured) {
    if (process.env.NODE_ENV === "production") throw new OutboxConfigurationError();
    return createHash("sha256").update("ax-finance-local-outbox-key").digest();
  }
  if (/^[a-f\d]{64}$/i.test(configured)) return Buffer.from(configured, "hex");
  return createHash("sha256").update(configured).digest();
}

function encryptPayload(payload: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  return `v1:${iv.toString("base64url")}:${cipher.getAuthTag().toString("base64url")}:${encrypted.toString("base64url")}`;
}

function decryptPayload(event: Pick<OutboxEvent, "payloadEncrypted">): unknown {
  try {
    const [version, iv, tag, encrypted] = event.payloadEncrypted.split(":");
    if (version !== "v1" || !iv || !tag || !encrypted) throw new Error("invalid payload");
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    const json = Buffer.concat([
      decipher.update(Buffer.from(encrypted, "base64url")),
      decipher.final(),
    ]).toString("utf8");
    return JSON.parse(json);
  } catch (error) {
    if (error instanceof OutboxConfigurationError) throw error;
    throw new Error("Payload da outbox inválido ou não pode ser decifrado.");
  }
}

function decodePayload<T>(event: Pick<OutboxEvent, "payloadEncrypted">, schema: z.ZodType<T>): T {
  try {
    return schema.parse(decryptPayload(event));
  } catch (error) {
    if (error instanceof OutboxConfigurationError) throw error;
    throw new Error("Payload da outbox inválido ou não pode ser decifrado.");
  }
}

export function decodeOutboxEmailPayload(event: Pick<OutboxEvent, "payloadEncrypted">) {
  return decodePayload(event, emailPayloadSchema);
}

export function decodeDueDateSummaryPayload(event: Pick<OutboxEvent, "payloadEncrypted">) {
  return decodePayload(event, dueDateSummaryPayloadSchema);
}

export function decodeWeeklySummaryPayload(event: Pick<OutboxEvent, "payloadEncrypted">) {
  return decodePayload(event, weeklySummaryPayloadSchema);
}

export async function enqueueOutboxEmail(
  tx: Prisma.TransactionClient,
  input: {
    type: Extract<OutboxEventType, "EMAIL_VERIFICATION" | "PASSWORD_RESET">;
    dedupKey: string;
    payload: OutboxEmailPayload;
  }
) {
  const payload = emailPayloadSchema.parse(input.payload);
  return tx.outboxEvent.create({
    data: {
      type: input.type,
      dedupKey: input.dedupKey,
      payloadEncrypted: encryptPayload(payload),
    },
  });
}

export async function enqueueDueDateSummaryEmail(
  tx: Prisma.TransactionClient,
  dedupKey: string,
  input: DueDateSummaryPayload
) {
  const payload = dueDateSummaryPayloadSchema.parse(input);
  return tx.outboxEvent.createMany({
    data: [{
      type: "DUE_DATE_SUMMARY",
      dedupKey,
      payloadEncrypted: encryptPayload(payload),
    }],
    skipDuplicates: true,
  });
}

export async function enqueueWeeklySummaryEmail(
  tx: Prisma.TransactionClient,
  dedupKey: string,
  input: WeeklySummaryPayload
) {
  const payload = weeklySummaryPayloadSchema.parse(input);
  return tx.outboxEvent.createMany({
    data: [{
      type: "WEEKLY_SUMMARY",
      dedupKey,
      payloadEncrypted: encryptPayload(payload),
    }],
    skipDuplicates: true,
  });
}

export async function claimOutboxEvents(workerId: string, requestedLimit = 10) {
  const limit = Math.max(1, Math.min(50, Math.trunc(requestedLimit)));
  return prisma.$transaction(async (tx) => {
    const claimedIds = await tx.$queryRaw<Array<{ id: string }>>`
      WITH candidates AS (
        SELECT "id"
        FROM "outbox_events"
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
      UPDATE "outbox_events" AS event
      SET
        "status" = 'PROCESSING',
        "locked_at" = (NOW() AT TIME ZONE 'UTC'),
        "locked_by" = ${workerId},
        "updated_at" = (NOW() AT TIME ZONE 'UTC')
      FROM candidates
      WHERE event."id" = candidates."id"
      RETURNING event."id"
    `;
    if (claimedIds.length === 0) return [];
    return tx.outboxEvent.findMany({
      where: { id: { in: claimedIds.map(({ id }) => id) } },
      orderBy: { createdAt: "asc" },
    });
  });
}

export async function completeOutboxEvent(eventId: string, workerId: string) {
  const result = await prisma.outboxEvent.updateMany({
    where: { id: eventId, status: "PROCESSING", lockedBy: workerId },
    data: {
      status: "PROCESSED",
      processedAt: new Date(),
      lockedAt: null,
      lockedBy: null,
      lastError: null,
      // O link já foi entregue; não há motivo para manter o token cifrado.
      payloadEncrypted: "",
    },
  });
  return result.count === 1;
}

export async function failOutboxEvent(eventId: string, workerId: string, error: unknown) {
  const event = await prisma.outboxEvent.findFirst({
    where: { id: eventId, status: "PROCESSING", lockedBy: workerId },
  });
  if (!event) return false;
  const attempts = event.attempts + 1;
  const deadLetter = attempts >= MAX_ATTEMPTS;
  const delay = RETRY_DELAYS_MS[Math.min(attempts - 1, RETRY_DELAYS_MS.length - 1)]!;
  const message = (error instanceof Error ? error.message : String(error))
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/[a-f0-9]{64}/gi, "[token]")
    .slice(0, 1000);
  const result = await prisma.outboxEvent.updateMany({
    where: { id: event.id, status: "PROCESSING", lockedBy: workerId, attempts: event.attempts },
    data: {
      status: deadLetter ? "DEAD_LETTER" : "PENDING",
      attempts,
      availableAt: deadLetter ? event.availableAt : new Date(Date.now() + delay),
      lockedAt: null,
      lockedBy: null,
      lastError: message,
    },
  });
  return result.count === 1;
}

export async function purgeProcessedOutboxEvents(olderThan = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) {
  return prisma.outboxEvent.deleteMany({
    where: { status: "PROCESSED", processedAt: { lt: olderThan } },
  });
}
