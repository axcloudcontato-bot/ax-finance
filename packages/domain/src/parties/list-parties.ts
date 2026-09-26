import { withCompanyContext } from "@ax-finance/db";
import { assertActiveMembership } from "../companies/assert-membership";

export interface ListPartiesFilter {
  role?: "CLIENT" | "SUPPLIER";
  status?: "ACTIVE" | "INACTIVE";
}

export async function listParties(
  userId: string,
  companyId: string,
  filter: ListPartiesFilter = {}
) {
  await assertActiveMembership(userId, companyId);

  return withCompanyContext(userId, companyId, (tx) =>
    tx.party.findMany({
      where: {
        companyId,
        ...(filter.role === "CLIENT" ? { isClient: true } : {}),
        ...(filter.role === "SUPPLIER" ? { isSupplier: true } : {}),
        ...(filter.status ? { status: filter.status } : {}),
      },
      orderBy: { name: "asc" },
    })
  );
}
