import type { PlatformAdminRole, Prisma } from "@ax-finance/db";
import { withUserContext } from "@ax-finance/db";
import { PlatformAdminAccessDeniedError } from "../errors";

export async function getPlatformAdminAccess(userId: string) {
  return withUserContext(userId, (tx) => tx.platformAdmin.findFirst({
    where: { userId, active: true }, select: { role: true, createdAt: true },
  }));
}

export async function assertPlatformAdminInTx(
  tx: Prisma.TransactionClient,
  userId: string,
  allowedRoles?: readonly PlatformAdminRole[]
) {
  const admin = await tx.platformAdmin.findFirst({ where: { userId, active: true } });
  if (!admin || (allowedRoles && !allowedRoles.includes(admin.role))) throw new PlatformAdminAccessDeniedError();
  return admin;
}

export async function assertPlatformAdmin(userId: string, allowedRoles?: readonly PlatformAdminRole[]) {
  return withUserContext(userId, (tx) => assertPlatformAdminInTx(tx, userId, allowedRoles));
}

export async function recordAdminAudit(
  tx: Prisma.TransactionClient,
  data: { actorUserId: string; action: string; targetType: string; targetId?: string; summary: string; metadata?: Prisma.InputJsonValue }
) {
  return tx.adminAuditEvent.create({ data });
}
