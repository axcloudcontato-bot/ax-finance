import { withCompanyContext } from "@ax-finance/db";
import { assertActiveMembership } from "../companies/assert-membership";

export async function listPeriodClosures(userId: string, companyId: string) {
  await assertActiveMembership(userId, companyId);

  return withCompanyContext(userId, companyId, (tx) =>
    tx.periodClosure.findMany({
      where: { companyId },
      orderBy: { period: "desc" },
    })
  );
}
