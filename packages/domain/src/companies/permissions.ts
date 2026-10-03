import type { MembershipRole } from "@ax-finance/db";
import { CompanyPermissionDeniedError } from "../errors";
import { assertActiveMembership } from "./assert-membership";
import { assertSubscriptionAllowsWrites } from "../subscriptions/write-access";

export type CompanyPermission =
  | "FINANCE_READ"
  | "FINANCE_WRITE"
  | "CATALOG_WRITE"
  | "EXPORT"
  | "REVERSAL"
  | "CLOSING"
  | "MEMBERS_MANAGE";

const ROLE_PERMISSIONS: Record<MembershipRole, readonly CompanyPermission[]> = {
  OWNER: [
    "FINANCE_READ",
    "FINANCE_WRITE",
    "CATALOG_WRITE",
    "EXPORT",
    "REVERSAL",
    "CLOSING",
    "MEMBERS_MANAGE",
  ],
  FINANCE_ADMIN: [
    "FINANCE_READ",
    "FINANCE_WRITE",
    "CATALOG_WRITE",
    "EXPORT",
    "REVERSAL",
    "CLOSING",
  ],
  OPERATOR: ["FINANCE_READ", "FINANCE_WRITE", "CATALOG_WRITE"],
  ACCOUNTANT: ["FINANCE_READ", "EXPORT"],
  VIEWER: ["FINANCE_READ"],
};

/** Permissões que criam ou alteram dados da empresa e, por isso, respeitam o bloqueio por assinatura. */
const WRITE_PERMISSIONS: readonly CompanyPermission[] = ["FINANCE_WRITE", "CATALOG_WRITE", "REVERSAL", "CLOSING"];

export function roleHasPermission(role: MembershipRole, permission: CompanyPermission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export async function assertCompanyPermission(
  userId: string,
  companyId: string,
  permission: CompanyPermission
) {
  const membership = await assertActiveMembership(userId, companyId);
  if (!roleHasPermission(membership.role, permission)) {
    throw new CompanyPermissionDeniedError();
  }
  // MEMBERS_MANAGE fica de fora de propósito: é o que dá acesso à cobrança, ao cancelamento e a
  // usuários, justamente o caminho para regularizar uma assinatura bloqueada.
  if (WRITE_PERMISSIONS.includes(permission)) {
    await assertSubscriptionAllowsWrites(userId, companyId);
  }
  return membership;
}

export async function getCompanyAccess(userId: string, companyId: string) {
  const membership = await assertActiveMembership(userId, companyId);
  return {
    role: membership.role,
    permissions: [...ROLE_PERMISSIONS[membership.role]],
  };
}
