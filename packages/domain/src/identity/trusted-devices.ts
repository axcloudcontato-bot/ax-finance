import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@ax-finance/db";

/** Por quanto tempo um dispositivo confiável dispensa o código em duas etapas. */
export const TRUSTED_DEVICE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_TRUSTED_DEVICES = 10;

type Client = Pick<typeof prisma, "trustedDevice">;

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export interface CreatedTrustedDevice {
  rawToken: string;
  expiresAt: Date;
}

/** O token bruto só vai para o cookie do navegador; o banco guarda o hash. Passa do limite? Os mais antigos saem. */
export async function createTrustedDevice(client: Client, userId: string, label: string): Promise<CreatedTrustedDevice> {
  const rawToken = randomBytes(32).toString("hex");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + TRUSTED_DEVICE_TTL_MS);
  await client.trustedDevice.create({
    data: { userId, tokenHash: hashToken(rawToken), label: label.slice(0, 120) || "Dispositivo", expiresAt, lastUsedAt: now },
  });
  const active = await client.trustedDevice.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: now } },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  const surplus = active.slice(MAX_TRUSTED_DEVICES).map((device) => device.id);
  if (surplus.length > 0) {
    await client.trustedDevice.updateMany({ where: { id: { in: surplus } }, data: { revokedAt: now } });
  }
  return { rawToken, expiresAt };
}

/** O dispositivo só vale para o usuário que o criou e enquanto não expirar nem for revogado. */
export async function isTrustedDevice(userId: string, rawToken: string | undefined): Promise<boolean> {
  if (!rawToken) return false;
  const now = new Date();
  const updated = await prisma.trustedDevice.updateMany({
    where: { tokenHash: hashToken(rawToken), userId, revokedAt: null, expiresAt: { gt: now } },
    data: { lastUsedAt: now },
  });
  return updated.count === 1;
}

export async function listTrustedDevices(userId: string) {
  return prisma.trustedDevice.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: { id: true, label: true, createdAt: true, lastUsedAt: true, expiresAt: true },
  });
}

export async function revokeTrustedDevice(userId: string, deviceId: string) {
  await prisma.trustedDevice.updateMany({ where: { id: deviceId, userId, revokedAt: null }, data: { revokedAt: new Date() } });
}

export async function revokeAllTrustedDevices(userId: string, client: Client = prisma) {
  await client.trustedDevice.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
}
