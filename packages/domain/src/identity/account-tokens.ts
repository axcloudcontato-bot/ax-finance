import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma, type AccountTokenType, type User } from "@ax-finance/db";
import { InvalidAccountTokenError } from "../errors";
import { enqueueOutboxEmail } from "../outbox/events";
import { hashPassword } from "./password";

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export interface AccountEmailDelivery {
  baseUrl: string;
  returnTo?: string;
}

export async function createAccountTokenWithClient(
  tx: import("@ax-finance/db").Prisma.TransactionClient,
  user: Pick<User, "id" | "email" | "name">,
  type: AccountTokenType,
  ttlMs: number,
  delivery?: AccountEmailDelivery
) {
  const rawToken = randomBytes(32).toString("hex");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMs);

  await tx.accountToken.updateMany({
    where: { userId: user.id, type, usedAt: null },
    data: { usedAt: now },
  });
  const accountToken = await tx.accountToken.create({
    data: { userId: user.id, type, tokenHash: hashToken(rawToken), expiresAt },
  });
  if (delivery) {
    await enqueueOutboxEmail(tx, {
      type,
      dedupKey: `account-token:${accountToken.id}`,
      payload: {
        to: user.email,
        name: user.name,
        rawToken,
        baseUrl: delivery.baseUrl.replace(/\/$/, ""),
        returnTo: type === "EMAIL_VERIFICATION" ? delivery.returnTo : undefined,
      },
    });
  }

  return { rawToken, expiresAt, queued: Boolean(delivery) };
}

async function createAccountToken(
  user: Pick<User, "id" | "email" | "name">,
  type: AccountTokenType,
  ttlMs: number,
  delivery?: AccountEmailDelivery
) {
  return prisma.$transaction((tx) => createAccountTokenWithClient(tx, user, type, ttlMs, delivery));
}

export async function issueEmailVerificationToken(userId: string, delivery?: AccountEmailDelivery) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.status !== "ACTIVE" || user.emailVerifiedAt) return null;
  const token = await createAccountToken(user, "EMAIL_VERIFICATION", EMAIL_VERIFICATION_TTL_MS, delivery);
  return { user, ...token };
}

export async function requestEmailVerification(email: string, delivery?: AccountEmailDelivery) {
  const parsed = z.string().email().toLowerCase().safeParse(email);
  if (!parsed.success) return null;
  const user = await prisma.user.findUnique({ where: { email: parsed.data } });
  if (!user || user.status !== "ACTIVE" || user.emailVerifiedAt) return null;
  const token = await createAccountToken(user, "EMAIL_VERIFICATION", EMAIL_VERIFICATION_TTL_MS, delivery);
  return { user, ...token };
}

export async function verifyEmail(rawToken: string) {
  if (!/^[a-f0-9]{64}$/i.test(rawToken)) throw new InvalidAccountTokenError();
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const token = await tx.accountToken.findUnique({ where: { tokenHash: hashToken(rawToken) } });
    if (!token || token.type !== "EMAIL_VERIFICATION" || token.usedAt || token.expiresAt <= now) {
      throw new InvalidAccountTokenError();
    }
    const claimed = await tx.accountToken.updateMany({
      where: { id: token.id, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (claimed.count !== 1) throw new InvalidAccountTokenError();
    return tx.user.update({ where: { id: token.userId }, data: { emailVerifiedAt: now } });
  });
}

export async function requestPasswordReset(email: string, delivery?: AccountEmailDelivery) {
  const parsed = z.string().email().toLowerCase().safeParse(email);
  if (!parsed.success) return null;
  const user = await prisma.user.findUnique({ where: { email: parsed.data } });
  if (!user || user.status !== "ACTIVE") return null;
  const token = await createAccountToken(user, "PASSWORD_RESET", PASSWORD_RESET_TTL_MS, delivery);
  return { user, ...token };
}

export async function resetPassword(rawToken: string, newPassword: string) {
  if (!/^[a-f0-9]{64}$/i.test(rawToken)) throw new InvalidAccountTokenError();
  const password = z.string().min(8).max(200).parse(newPassword);
  const now = new Date();
  const tokenHash = hashToken(rawToken);
  const existing = await prisma.accountToken.findUnique({ where: { tokenHash } });
  if (!existing || existing.type !== "PASSWORD_RESET" || existing.usedAt || existing.expiresAt <= now) {
    throw new InvalidAccountTokenError();
  }

  // O hash scrypt é propositalmente caro; só o calculamos depois de validar
  // que o token aleatório realmente existe, evitando DoS com tokens inventados.
  const passwordHash = await hashPassword(password);

  return prisma.$transaction(async (tx) => {
    const token = await tx.accountToken.findUnique({ where: { tokenHash } });
    if (!token || token.type !== "PASSWORD_RESET" || token.usedAt || token.expiresAt <= now) {
      throw new InvalidAccountTokenError();
    }
    const claimed = await tx.accountToken.updateMany({
      where: { id: token.id, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (claimed.count !== 1) throw new InvalidAccountTokenError();

    const user = await tx.user.update({
      where: { id: token.userId },
      data: { passwordHash },
    });
    await tx.session.updateMany({
      where: { userId: token.userId, revokedAt: null },
      data: { revokedAt: now },
    });
    // Senha redefinida: os dispositivos confiáveis voltam a pedir o código.
    await tx.trustedDevice.updateMany({ where: { userId: token.userId, revokedAt: null }, data: { revokedAt: now } });
    return user;
  });
}
