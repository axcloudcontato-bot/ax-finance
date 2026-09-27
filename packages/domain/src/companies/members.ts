import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { withCompanyContext, withUserContext } from "@ax-finance/db";
import {
  CompanyInvitationEmailMismatchError,
  CompanyInvitationInvalidError,
  CompanyMemberAlreadyActiveError,
  CompanyMemberNotFoundError,
  CompanyAccessScopeInvalidError,
  CompanyOwnershipTransferInvalidError,
  CompanyOwnerProtectedError,
} from "../errors";
import { recordAuditEvent } from "../audit/record-audit-event";
import { enqueueAccessChangedEmail, enqueueCompanyInvitationEmail } from "../outbox/events";
import { assertCompanyPermission } from "./permissions";

const invitationRole = z.enum(["FINANCE_ADMIN", "OPERATOR", "ACCOUNTANT", "VIEWER"]);
const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const ROLE_LABEL = {
  FINANCE_ADMIN: "Administrador financeiro",
  OPERATOR: "Operador",
  ACCOUNTANT: "Contador",
  VIEWER: "Consulta",
} as const;

export const createCompanyInvitationInput = z.object({
  email: z.string().trim().email().max(254).toLowerCase(),
  role: invitationRole,
});

export const updateCompanyMemberRoleInput = z.object({ role: invitationRole });
export const updateCompanyMemberAccessInput = z.object({
  accessScope: z.enum(["ALL", "RESTRICTED"]),
  financialAccountIds: z.array(z.string().uuid()).max(100).default([]),
  costCenterIds: z.array(z.string().uuid()).max(100).default([]),
});

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export async function listCompanyMembers(userId: string, companyId: string) {
  await assertCompanyPermission(userId, companyId, "MEMBERS_MANAGE");
  return withCompanyContext(userId, companyId, (tx) =>
    tx.membership.findMany({
      where: { companyId },
      include: {
        user: { select: { name: true, email: true } },
        accountAccess: { select: { financialAccountId: true } },
        costCenterAccess: { select: { costCenterId: true } },
      },
      orderBy: { createdAt: "asc" },
    })
  );
}

export async function updateCompanyMemberAccess(
  userId: string,
  companyId: string,
  membershipId: string,
  input: unknown
) {
  const data = updateCompanyMemberAccessInput.parse(input);
  await assertCompanyPermission(userId, companyId, "MEMBERS_MANAGE");
  return withCompanyContext(userId, companyId, async (tx) => {
    const membership = await tx.membership.findFirst({
      where: { id: membershipId, companyId, status: "ACTIVE" },
      include: { user: true },
    });
    if (!membership) throw new CompanyMemberNotFoundError();
    if (membership.role === "OWNER" && data.accessScope !== "ALL") throw new CompanyOwnerProtectedError();

    const accountIds = [...new Set(data.financialAccountIds)];
    const costCenterIds = [...new Set(data.costCenterIds)];
    const [accountCount, costCenterCount] = await Promise.all([
      tx.financialAccount.count({ where: { companyId, id: { in: accountIds } } }),
      tx.costCenter.count({ where: { companyId, id: { in: costCenterIds } } }),
    ]);
    if (accountCount !== accountIds.length || costCenterCount !== costCenterIds.length) {
      throw new CompanyAccessScopeInvalidError();
    }

    await Promise.all([
      tx.membershipFinancialAccount.deleteMany({ where: { membershipId } }),
      tx.membershipCostCenter.deleteMany({ where: { membershipId } }),
    ]);
    await tx.membership.update({ where: { id: membershipId }, data: { accessScope: data.accessScope } });
    if (data.accessScope === "RESTRICTED") {
      await Promise.all([
        accountIds.length ? tx.membershipFinancialAccount.createMany({
          data: accountIds.map((financialAccountId) => ({ companyId, membershipId, financialAccountId })),
        }) : Promise.resolve(),
        costCenterIds.length ? tx.membershipCostCenter.createMany({
          data: costCenterIds.map((costCenterId) => ({ companyId, membershipId, costCenterId })),
        }) : Promise.resolve(),
      ]);
    }

    await recordAuditEvent(tx, {
      companyId,
      actorUserId: userId,
      eventType: "COMPANY_MEMBER_ACCESS_UPDATED",
      resourceType: "Membership",
      resourceId: membershipId,
      summary: "Escopo de acesso atualizado",
      metadata: {
        targetUserId: membership.userId,
        accessScope: data.accessScope,
        financialAccountIds: data.accessScope === "RESTRICTED" ? accountIds.join(",") : "",
        costCenterIds: data.accessScope === "RESTRICTED" ? costCenterIds.join(",") : "",
      },
    });
    return tx.membership.findUniqueOrThrow({ where: { id: membershipId } });
  });
}

export async function transferCompanyOwnership(userId: string, companyId: string, targetMembershipId: string) {
  await assertCompanyPermission(userId, companyId, "MEMBERS_MANAGE");
  return withCompanyContext(userId, companyId, async (tx) => {
    const [currentOwner, target, company] = await Promise.all([
      tx.membership.findFirst({ where: { companyId, userId, role: "OWNER", status: "ACTIVE" }, include: { user: true } }),
      tx.membership.findFirst({ where: { id: targetMembershipId, companyId, status: "ACTIVE" }, include: { user: true } }),
      tx.company.findUniqueOrThrow({ where: { id: companyId } }),
    ]);
    if (!currentOwner || !target || target.id === currentOwner.id || target.role === "OWNER") {
      throw new CompanyOwnershipTransferInvalidError();
    }

    await tx.membership.update({
      where: { id: currentOwner.id },
      data: { role: "FINANCE_ADMIN", accessScope: "ALL" },
    });
    const newOwner = await tx.membership.update({
      where: { id: target.id },
      data: { role: "OWNER", accessScope: "ALL" },
    });
    await Promise.all([
      tx.membershipFinancialAccount.deleteMany({ where: { membershipId: target.id } }),
      tx.membershipCostCenter.deleteMany({ where: { membershipId: target.id } }),
    ]);

    await recordAuditEvent(tx, {
      companyId,
      actorUserId: userId,
      eventType: "COMPANY_OWNERSHIP_TRANSFERRED",
      resourceType: "Company",
      resourceId: companyId,
      summary: `Propriedade transferida para ${target.user.email}`,
      metadata: { previousOwnerUserId: currentOwner.userId, newOwnerUserId: target.userId },
    });
    await tx.notification.createMany({
      data: [
        { companyId, userId: target.userId, type: "ACCESS_ROLE_CHANGED", dedupKey: `ownership:${companyId}:${target.userId}:${newOwner.updatedAt.toISOString()}`, title: "Você agora é o proprietário", body: `A propriedade de ${company.name} foi transferida para você.`, href: "/configuracoes/usuarios" },
        { companyId, userId: currentOwner.userId, type: "ACCESS_ROLE_CHANGED", dedupKey: `ownership:${companyId}:${currentOwner.userId}:${newOwner.updatedAt.toISOString()}`, title: "Propriedade transferida", body: `${target.user.name} agora é o proprietário de ${company.name}.`, href: "/dashboard" },
      ],
      skipDuplicates: true,
    });
    await Promise.all([
      enqueueAccessChangedEmail(tx, `ownership-new:${companyId}:${newOwner.updatedAt.toISOString()}`, { to: target.user.email, name: target.user.name, companyName: company.name, kind: "OWNERSHIP_TRANSFERRED", role: "OWNER", actorName: currentOwner.user.name }),
      enqueueAccessChangedEmail(tx, `ownership-old:${companyId}:${newOwner.updatedAt.toISOString()}`, { to: currentOwner.user.email, name: currentOwner.user.name, companyName: company.name, kind: "OWNERSHIP_TRANSFERRED", role: "FINANCE_ADMIN", actorName: currentOwner.user.name, targetName: target.user.name }),
    ]);
    return newOwner;
  });
}

export async function listCompanyInvitations(userId: string, companyId: string) {
  await assertCompanyPermission(userId, companyId, "MEMBERS_MANAGE");
  return withCompanyContext(userId, companyId, (tx) =>
    tx.companyInvitation.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
    })
  );
}

export async function createCompanyInvitation(userId: string, companyId: string, input: unknown) {
  const data = createCompanyInvitationInput.parse(input);
  await assertCompanyPermission(userId, companyId, "MEMBERS_MANAGE");

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);

  const invitation = await withCompanyContext(userId, companyId, async (tx) => {
    const [company, inviter] = await Promise.all([
      tx.company.findUniqueOrThrow({ where: { id: companyId } }),
      tx.user.findUniqueOrThrow({ where: { id: userId } }),
    ]);
    const activeMember = await tx.membership.findFirst({
      where: { companyId, status: "ACTIVE", user: { email: data.email } },
    });
    if (activeMember) throw new CompanyMemberAlreadyActiveError();
    const result = await tx.companyInvitation.upsert({
      where: { companyId_email: { companyId, email: data.email } },
      create: {
        companyId,
        companyName: company.name,
        email: data.email,
        role: data.role,
        tokenHash,
        invitedByUserId: userId,
        expiresAt,
      },
      update: {
        role: data.role,
        companyName: company.name,
        tokenHash,
        status: "PENDING",
        invitedByUserId: userId,
        expiresAt,
        acceptedAt: null,
        revokedAt: null,
      },
    });

    await recordAuditEvent(tx, {
      companyId,
      actorUserId: userId,
      eventType: "COMPANY_INVITATION_CREATED",
      resourceType: "CompanyInvitation",
      resourceId: result.id,
      summary: `Convite criado para ${data.email}`,
      metadata: { email: data.email, role: data.role },
    });

    await enqueueCompanyInvitationEmail(
      tx,
      `company-invitation:${result.id}:${tokenHash.slice(0, 16)}`,
      {
        to: result.email,
        companyName: company.name,
        invitedByName: inviter.name,
        role: data.role,
        rawToken,
        expiresAt: result.expiresAt.toISOString(),
      }
    );

    return result;
  });

  return { invitation, rawToken };
}

export async function getCompanyInvitationByToken(userId: string, rawToken: string) {
  if (!/^[a-f0-9]{64}$/i.test(rawToken)) {
    throw new CompanyInvitationInvalidError();
  }

  const invitation = await withUserContext(userId, (tx) =>
    tx.companyInvitation.findUnique({ where: { tokenHash: hashToken(rawToken) } })
  );

  if (!invitation || invitation.status !== "PENDING" || invitation.expiresAt <= new Date()) {
    throw new CompanyInvitationInvalidError();
  }

  return invitation;
}

export async function acceptCompanyInvitation(userId: string, rawToken: string) {
  if (!/^[a-f0-9]{64}$/i.test(rawToken)) {
    throw new CompanyInvitationInvalidError();
  }

  return withUserContext(userId, async (tx) => {
    const invitation = await tx.companyInvitation.findUnique({
      where: { tokenHash: hashToken(rawToken) },
    });
    const user = await tx.user.findUnique({ where: { id: userId } });

    if (!invitation || invitation.status !== "PENDING" || invitation.expiresAt <= new Date()) {
      throw new CompanyInvitationInvalidError();
    }
    if (!user || user.email.toLowerCase() !== invitation.email) {
      throw new CompanyInvitationEmailMismatchError();
    }

    await tx.$executeRaw`SELECT set_config('app.current_company_id', ${invitation.companyId}, true)`;

    const existingMembership = await tx.membership.findUnique({
      where: { userId_companyId: { userId, companyId: invitation.companyId } },
    });
    if (existingMembership?.role === "OWNER") throw new CompanyOwnerProtectedError();
    if (existingMembership?.status === "ACTIVE") throw new CompanyMemberAlreadyActiveError();

    const claimed = await tx.companyInvitation.updateMany({
      where: { id: invitation.id, status: "PENDING", expiresAt: { gt: new Date() } },
      data: { status: "ACCEPTED", acceptedAt: new Date() },
    });
    if (claimed.count !== 1) {
      throw new CompanyInvitationInvalidError();
    }

    const membership = await tx.membership.upsert({
      where: { userId_companyId: { userId, companyId: invitation.companyId } },
      create: {
        userId,
        companyId: invitation.companyId,
        role: invitation.role,
        status: "ACTIVE",
      },
      update: { role: invitation.role, status: "ACTIVE" },
    });

    await recordAuditEvent(tx, {
      companyId: invitation.companyId,
      actorUserId: userId,
      eventType: "COMPANY_INVITATION_ACCEPTED",
      resourceType: "Membership",
      resourceId: membership.id,
      summary: `${user.email} aceitou o convite`,
      metadata: { email: user.email, role: invitation.role },
    });

    const inviter = await tx.user.findUnique({ where: { id: invitation.invitedByUserId } });
    if (inviter) {
      await tx.notification.createMany({
        data: [{
          companyId: invitation.companyId,
          userId: inviter.id,
          type: "INVITATION_ACCEPTED",
          dedupKey: `invitation-accepted:${invitation.id}:${inviter.id}`,
          title: "Convite aceito",
          body: `${user.name} agora tem acesso como ${ROLE_LABEL[invitationRole.parse(invitation.role)]}.`,
          href: "/configuracoes/usuarios",
        }],
        skipDuplicates: true,
      });
      await enqueueAccessChangedEmail(
        tx,
        `access-invitation-accepted:${invitation.id}:${inviter.id}`,
        {
          to: inviter.email,
          name: inviter.name,
          companyName: invitation.companyName,
          kind: "INVITATION_ACCEPTED",
          role: invitationRole.parse(invitation.role),
          targetName: user.name,
        }
      );
    }

    return membership;
  });
}

export async function revokeCompanyInvitation(userId: string, companyId: string, invitationId: string) {
  await assertCompanyPermission(userId, companyId, "MEMBERS_MANAGE");
  return withCompanyContext(userId, companyId, async (tx) => {
    const invitation = await tx.companyInvitation.findFirst({
      where: { id: invitationId, companyId, status: "PENDING" },
    });
    if (!invitation) throw new CompanyInvitationInvalidError();

    const revoked = await tx.companyInvitation.update({
      where: { id: invitation.id },
      data: { status: "REVOKED", revokedAt: new Date() },
    });
    await recordAuditEvent(tx, {
      companyId,
      actorUserId: userId,
      eventType: "COMPANY_INVITATION_REVOKED",
      resourceType: "CompanyInvitation",
      resourceId: invitation.id,
      summary: `Convite de ${invitation.email} revogado`,
    });
    const actor = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    await enqueueAccessChangedEmail(tx, `access-invitation-revoked:${invitation.id}`, {
      to: invitation.email,
      name: invitation.email.split("@")[0] || "Usuário",
      companyName: invitation.companyName,
      kind: "INVITATION_REVOKED",
      actorName: actor.name,
    });
    return revoked;
  });
}

export async function updateCompanyMemberRole(
  userId: string,
  companyId: string,
  membershipId: string,
  input: unknown
) {
  const data = updateCompanyMemberRoleInput.parse(input);
  await assertCompanyPermission(userId, companyId, "MEMBERS_MANAGE");
  return withCompanyContext(userId, companyId, async (tx) => {
    const membership = await tx.membership.findFirst({
      where: { id: membershipId, companyId, status: "ACTIVE" },
      include: { user: true },
    });
    if (!membership) throw new CompanyMemberNotFoundError();
    if (membership.role === "OWNER") throw new CompanyOwnerProtectedError();

    const updated = await tx.membership.update({
      where: { id: membership.id },
      data: { role: data.role },
    });
    await recordAuditEvent(tx, {
      companyId,
      actorUserId: userId,
      eventType: "COMPANY_MEMBER_ROLE_UPDATED",
      resourceType: "Membership",
      resourceId: membership.id,
      summary: "Papel de usuário atualizado",
      metadata: { previousRole: membership.role, role: data.role },
    });
    const [company, actor] = await Promise.all([
      tx.company.findUniqueOrThrow({ where: { id: companyId } }),
      tx.user.findUniqueOrThrow({ where: { id: userId } }),
    ]);
    await tx.notification.createMany({
      data: [{
        companyId,
        userId: membership.userId,
        type: "ACCESS_ROLE_CHANGED",
        dedupKey: `access-role:${membership.id}:${updated.updatedAt.toISOString()}`,
        title: "Seu acesso foi alterado",
        body: `Seu novo papel em ${company.name} é ${ROLE_LABEL[data.role]}.`,
        href: "/dashboard",
      }],
      skipDuplicates: true,
    });
    await enqueueAccessChangedEmail(tx, `access-role-email:${membership.id}:${updated.updatedAt.toISOString()}`, {
      to: membership.user.email,
      name: membership.user.name,
      companyName: company.name,
      kind: "ROLE_CHANGED",
      role: data.role,
      actorName: actor.name,
    });
    return updated;
  });
}

export async function revokeCompanyMember(userId: string, companyId: string, membershipId: string) {
  await assertCompanyPermission(userId, companyId, "MEMBERS_MANAGE");
  return withCompanyContext(userId, companyId, async (tx) => {
    const membership = await tx.membership.findFirst({
      where: { id: membershipId, companyId, status: "ACTIVE" },
      include: { user: true },
    });
    if (!membership) throw new CompanyMemberNotFoundError();
    if (membership.role === "OWNER") throw new CompanyOwnerProtectedError();

    const revoked = await tx.membership.update({
      where: { id: membership.id },
      data: { status: "REVOKED" },
    });
    await recordAuditEvent(tx, {
      companyId,
      actorUserId: userId,
      eventType: "COMPANY_MEMBER_REVOKED",
      resourceType: "Membership",
      resourceId: membership.id,
      summary: "Acesso de usuário revogado",
      metadata: { targetUserId: membership.userId, role: membership.role },
    });
    const [company, actor] = await Promise.all([
      tx.company.findUniqueOrThrow({ where: { id: companyId } }),
      tx.user.findUniqueOrThrow({ where: { id: userId } }),
    ]);
    await enqueueAccessChangedEmail(tx, `access-revoked:${membership.id}`, {
      to: membership.user.email,
      name: membership.user.name,
      companyName: company.name,
      kind: "ACCESS_REVOKED",
      actorName: actor.name,
    });
    return revoked;
  });
}
