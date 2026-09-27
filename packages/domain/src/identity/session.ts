import { randomBytes, createHash } from "node:crypto";
import { prisma } from "@ax-finance/db";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export interface CreatedSession {
  rawToken: string;
  expiresAt: Date;
}

/**
 * O token bruto só existe em memória e no cookie do navegador — o banco
 * guarda apenas o hash, então um vazamento de linha da tabela não permite
 * forjar sessões (Seção 17: sessões revogáveis, sem senha nem token em claro).
 */
export async function createSessionWithClient(
  client: Pick<typeof prisma, "session">,
  userId: string
): Promise<CreatedSession> {
  const rawToken = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await client.session.create({
    data: {
      userId,
      tokenHash: hashToken(rawToken),
      expiresAt,
    },
  });

  return { rawToken, expiresAt };
}

export async function createSession(userId: string): Promise<CreatedSession> {
  return createSessionWithClient(prisma, userId);
}

export async function resolveSession(rawToken: string) {
  const tokenHash = hashToken(rawToken);
  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!session) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt.getTime() < Date.now()) return null;
  if (session.user.status !== "ACTIVE") return null;

  return session;
}

export async function revokeSession(rawToken: string): Promise<void> {
  const tokenHash = hashToken(rawToken);
  await prisma.session.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
