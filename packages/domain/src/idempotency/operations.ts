import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import type { Prisma } from "@ax-finance/db";
import { IdempotencyConflictError, IdempotencyResultUnavailableError } from "../errors";

export const idempotencyKeySchema = z.string().uuid().optional();

function canonicalize(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, child]) => child !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)])
    );
  }
  return value;
}

export function hashIdempotencyRequest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex");
}

export type IdempotencyHandle =
  | { kind: "new"; recordId: string }
  | { kind: "replay"; resourceId: string }
  | { kind: "disabled" };

export async function beginIdempotentOperation(
  tx: Prisma.TransactionClient,
  input: {
    companyId: string;
    operation: string;
    key?: string;
    request: unknown;
    resourceType: string;
  }
): Promise<IdempotencyHandle> {
  if (!input.key) return { kind: "disabled" };
  const key = z.string().uuid().parse(input.key);
  const requestHash = hashIdempotencyRequest(input.request);
  const recordId = randomUUID();
  const inserted = await tx.$queryRaw<Array<{ id: string }>>`
    INSERT INTO "idempotency_records"
      ("id", "company_id", "operation", "key", "request_hash", "resource_type", "created_at")
    VALUES
      (${recordId}, ${input.companyId}, ${input.operation}, ${key}, ${requestHash}, ${input.resourceType}, NOW() AT TIME ZONE 'UTC')
    ON CONFLICT ("company_id", "operation", "key") DO NOTHING
    RETURNING "id"
  `;
  if (inserted.length === 1) return { kind: "new", recordId };

  const existing = await tx.idempotencyRecord.findUnique({
    where: {
      companyId_operation_key: {
        companyId: input.companyId,
        operation: input.operation,
        key,
      },
    },
  });
  if (!existing || !existing.resourceId) throw new IdempotencyResultUnavailableError();
  if (existing.requestHash !== requestHash || existing.resourceType !== input.resourceType) {
    throw new IdempotencyConflictError();
  }
  return { kind: "replay", resourceId: existing.resourceId };
}

export async function completeIdempotentOperation(
  tx: Prisma.TransactionClient,
  handle: IdempotencyHandle,
  resourceId: string
) {
  if (handle.kind !== "new") return;
  const completed = await tx.idempotencyRecord.updateMany({
    where: { id: handle.recordId, resourceId: null },
    data: { resourceId },
  });
  if (completed.count !== 1) throw new IdempotencyResultUnavailableError();
}
