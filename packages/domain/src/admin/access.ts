import type { PlatformAdminRole, Prisma } from "@ax-finance/db";
import { withUserContext } from "@ax-finance/db";
import { PlatformAdminAccessDeniedError, PlatformAdminMfaRequiredError } from "../errors";

export async function getPlatformAdminAccess(userId: string) {
  const admin = await withUserContext(userId, (tx) => tx.platformAdmin.findFirst({
    where: { userId, active: true },
    select: { role: true, createdAt: true, user: { select: { mfaEnabledAt: true } } },
  }));
  if (!admin) return null;
  return { role: admin.role, createdAt: admin.createdAt, mfaEnabled: Boolean(admin.user.mfaEnabledAt) };
}

/**
 * MFA é obrigatório para quem opera a administração interna (DIRECAO §22):
 * a checagem fica aqui, e não só na tela, para valer também para server
 * actions e qualquer outro chamador do domínio.
 */
export async function assertPlatformAdminInTx(
  tx: Prisma.TransactionClient,
  userId: string,
  allowedRoles?: readonly PlatformAdminRole[]
) {
  const admin = await tx.platformAdmin.findFirst({
    where: { userId, active: true },
    include: { user: { select: { mfaEnabledAt: true } } },
  });
  if (!admin || (allowedRoles && !allowedRoles.includes(admin.role))) throw new PlatformAdminAccessDeniedError();
  if (!admin.user.mfaEnabledAt) throw new PlatformAdminMfaRequiredError();
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
