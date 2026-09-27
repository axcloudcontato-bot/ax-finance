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

export async function recordLoginFailure(email: string, ipAddress?: string): Promise<boolean> {
  const now = new Date();
  let blocked = false;

  for (const item of keysFor(email, ipAddress)) {
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.loginRateLimit.findUnique({ where: { keyHash: item.keyHash } });
      const windowExpired = !current || current.windowStartedAt.getTime() + WINDOW_MS <= now.getTime();
      const failedAttempts = windowExpired ? 1 : current.failedAttempts + 1;
      const blockedUntil = failedAttempts >= item.limit ? new Date(now.getTime() + BLOCK_MS) : null;
      return tx.loginRateLimit.upsert({
        where: { keyHash: item.keyHash },
        create: { keyHash: item.keyHash, failedAttempts, windowStartedAt: now, blockedUntil },
        update: {
          failedAttempts,
          windowStartedAt: windowExpired ? now : current!.windowStartedAt,
          blockedUntil,
        },
      });
    });
    blocked ||= Boolean(result.blockedUntil && result.blockedUntil > now);
  }

  return blocked;
}

export async function clearLoginFailures(email: string, ipAddress?: string) {
  await prisma.loginRateLimit.deleteMany({
    where: { keyHash: { in: keysFor(email, ipAddress).map((item) => item.keyHash) } },
  });
}
