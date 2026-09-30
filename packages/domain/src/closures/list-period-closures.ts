import { withCompanyContext } from "@ax-finance/db";
import { assertActiveMembership } from "../companies/assert-membership";
import { assertCompanyPlanFeature } from "../subscriptions/plan-features";

export async function listPeriodClosures(userId: string, companyId: string) {
  await assertActiveMembership(userId, companyId);
  await assertCompanyPlanFeature(userId, companyId, "PERIOD_CLOSING");

  return withCompanyContext(userId, companyId, (tx) =>
    tx.periodClosure.findMany({
      where: { companyId },
      orderBy: { period: "desc" },
    })
  );
}
