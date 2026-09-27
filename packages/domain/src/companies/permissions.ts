import type { MembershipRole } from "@ax-finance/db";
import { CompanyPermissionDeniedError } from "../errors";
import { assertActiveMembership } from "./assert-membership";

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
  return membership;
}

export async function getCompanyAccess(userId: string, companyId: string) {
  const membership = await assertActiveMembership(userId, companyId);
  return {
    role: membership.role,
    permissions: [...ROLE_PERMISSIONS[membership.role]],
  };
}
