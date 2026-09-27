import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { withCompanyContext, withUserContext } from "@ax-finance/db";
import {
  CompanyInvitationEmailMismatchError,
  CompanyInvitationInvalidError,
  CompanyMemberAlreadyActiveError,
  CompanyMemberNotFoundError,
  CompanyOwnerProtectedError,
} from "../errors";
import { recordAuditEvent } from "../audit/record-audit-event";
import { assertCompanyPermission } from "./permissions";

const invitationRole = z.enum(["FINANCE_ADMIN", "OPERATOR", "ACCOUNTANT", "VIEWER"]);
const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const createCompanyInvitationInput = z.object({
  email: z.string().trim().email().max(254).toLowerCase(),
  role: invitationRole,
});

export const updateCompanyMemberRoleInput = z.object({ role: invitationRole });

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export async function listCompanyMembers(userId: string, companyId: string) {
  await assertCompanyPermission(userId, companyId, "MEMBERS_MANAGE");
  return withCompanyContext(userId, companyId, (tx) =>
    tx.membership.findMany({
      where: { companyId },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    })
  );
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
    const company = await tx.company.findUniqueOrThrow({ where: { id: companyId } });
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
    const membership = await tx.membership.findFirst({ where: { id: membershipId, companyId, status: "ACTIVE" } });
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
    return updated;
  });
}

export async function revokeCompanyMember(userId: string, companyId: string, membershipId: string) {
  await assertCompanyPermission(userId, companyId, "MEMBERS_MANAGE");
  return withCompanyContext(userId, companyId, async (tx) => {
    const membership = await tx.membership.findFirst({ where: { id: membershipId, companyId, status: "ACTIVE" } });
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
    return revoked;
  });
}
