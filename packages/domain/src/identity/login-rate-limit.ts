import { createHash } from "node:crypto";
import { prisma } from "@ax-finance/db";
import { TooManyLoginAttemptsError } from "../errors";

const WINDOW_MS = 15 * 60 * 1000;
const BLOCK_MS = 15 * 60 * 1000;
const EMAIL_LIMIT = 5;
const IP_LIMIT = 20;

function keyHash(kind: "email" | "ip", value: string): string {
  return createHash("sha256").update(`${kind}:${value.trim().toLowerCase()}`).digest("hex");
}

function keysFor(email: string, ipAddress?: string) {
  return [
    { keyHash: keyHash("email", email), limit: EMAIL_LIMIT },
    ...(ipAddress ? [{ keyHash: keyHash("ip", ipAddress), limit: IP_LIMIT }] : []),
  ];
}

export async function assertLoginAllowed(email: string, ipAddress?: string) {
  const now = new Date();
  const keys = keysFor(email, ipAddress);
  if (keys.length === 0) return;
  const limits = await prisma.loginRateLimit.findMany({
    where: { keyHash: { in: keys.map((item) => item.keyHash) }, blockedUntil: { gt: now } },
  });
  if (limits.length > 0) throw new TooManyLoginAttemptsError();
}

/** "YYYY-MM-DD HH:MM:SS.mmm" em UTC, o formato das colunas timestamp(3) sem fuso. */
function utcTimestamp(date: Date): string {
  return date.toISOString().replace("T", " ").replace("Z", "");
}

/**
 * Conta a falha com um único INSERT ... ON CONFLICT: o incremento acontece no banco, então tentativas
 * simultâneas não se perdem (ler e regravar deixava passar mais tentativas que o limite).
 */
export async function recordLoginFailure(email: string, ipAddress?: string): Promise<boolean> {
  const now = new Date();
  const nowSql = utcTimestamp(now);
  const windowFloor = utcTimestamp(new Date(now.getTime() - WINDOW_MS));
  const blockUntil = utcTimestamp(new Date(now.getTime() + BLOCK_MS));
  let blocked = false;

  for (const item of keysFor(email, ipAddress)) {
    const rows = await prisma.$queryRaw<{ blocked: boolean }[]>`
      INSERT INTO "login_rate_limits" ("key_hash", "failed_attempts", "window_started_at", "blocked_until", "updated_at")
      VALUES (${item.keyHash}, 1, ${nowSql}::timestamp(3), CASE WHEN 1 >= ${item.limit}::int THEN ${blockUntil}::timestamp(3) END, ${nowSql}::timestamp(3))
      ON CONFLICT ("key_hash") DO UPDATE SET
        "failed_attempts" = CASE WHEN "login_rate_limits"."window_started_at" <= ${windowFloor}::timestamp(3) THEN 1 ELSE "login_rate_limits"."failed_attempts" + 1 END,
        "window_started_at" = CASE WHEN "login_rate_limits"."window_started_at" <= ${windowFloor}::timestamp(3) THEN ${nowSql}::timestamp(3) ELSE "login_rate_limits"."window_started_at" END,
        "blocked_until" = CASE
          WHEN (CASE WHEN "login_rate_limits"."window_started_at" <= ${windowFloor}::timestamp(3) THEN 1 ELSE "login_rate_limits"."failed_attempts" + 1 END) >= ${item.limit}::int
          THEN ${blockUntil}::timestamp(3)
        END,
        "updated_at" = ${nowSql}::timestamp(3)
      RETURNING ("blocked_until" IS NOT NULL AND "blocked_until" > ${nowSql}::timestamp(3)) AS "blocked"
    `;
    blocked ||= Boolean(rows[0]?.blocked);
  }

  return blocked;
}

export async function clearLoginFailures(email: string, ipAddress?: string) {
  await prisma.loginRateLimit.deleteMany({
    where: { keyHash: { in: keysFor(email, ipAddress).map((item) => item.keyHash) } },
  });
}
