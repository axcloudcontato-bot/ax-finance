import { withUserContext } from "@ax-finance/db";
import { assertPlatformAdminInTx } from "./access";
import { loadAdminCompanyStats } from "./company-stats";

const PAID_STATUSES = ["ACTIVE", "PAYMENT_PENDING", "GRACE_PERIOD", "SUSPENDED", "CANCELLATION_SCHEDULED"] as const;

function monthStart(date: Date, offset: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, 1));
}

export async function getAdminBusinessMetrics(userId: string, now = new Date()) {
  return withUserContext(userId, async (tx) => {
    await assertPlatformAdminInTx(tx, userId);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000);
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 86_400_000);
    const stats = await loadAdminCompanyStats(tx);
    const statRows = [...stats.values()];
    const activated = statRows.filter((item) => item.activeTitles > 0).length;
    const newActivated = statRows.filter((item) => item.createdAt >= thirtyDaysAgo && item.activeTitles > 0).length;
    const [total, active, newCompanies, trials, trialsExpiring, paid, cancelled, delinquent, openSupport, activeIncidents] = await Promise.all([
      tx.company.count(), tx.company.count({ where: { status: "ACTIVE" } }),
      tx.company.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      tx.subscription.count({ where: { status: "TRIAL" } }), tx.subscription.count({ where: { status: "TRIAL", trialEndsAt: { gte: now, lte: sevenDaysFromNow } } }),
      tx.subscription.count({ where: { status: { in: [...PAID_STATUSES] } } }), tx.subscription.count({ where: { status: "CANCELLED" } }),
      tx.subscription.count({ where: { status: { in: ["PAYMENT_PENDING", "GRACE_PERIOD", "SUSPENDED"] } } }),
      tx.supportCase.count({ where: { status: { in: ["OPEN", "IN_PROGRESS", "WAITING_CUSTOMER"] } } }),
      tx.incident.count({ where: { status: { not: "RESOLVED" } } }),
    ]);
    const cohorts = [];
    for (let offset = -5; offset <= 0; offset++) {
      const from = monthStart(now, offset); const to = monthStart(now, offset + 1);
      const companies = await tx.company.findMany({ where: { createdAt: { gte: from, lt: to } }, select: { id: true, subscription: { select: { status: true } } } });
      const cohortPaid = companies.filter((item) => item.subscription && PAID_STATUSES.includes(item.subscription.status as typeof PAID_STATUSES[number])).length;
      const cohortActivated = companies.filter((item) => (stats.get(item.id)?.titles ?? 0) > 0).length;
      cohorts.push({ month: from.toISOString().slice(0, 7), companies: companies.length, activated: cohortActivated, converted: cohortPaid });
    }
    return {
      totalCompanies: total, activeCompanies: active, activatedCompanies: activated,
      activationRate: total ? activated / total : 0, newCompanies30d: newCompanies, newActivated30d: newActivated,
      trialCompanies: trials, trialsExpiring7d: trialsExpiring, paidCompanies: paid,
      conversionRate: paid + cancelled ? paid / (paid + cancelled) : 0,
      cancelledCompanies: cancelled, cancellationRate: paid + cancelled ? cancelled / (paid + cancelled) : 0,
      delinquentCompanies: delinquent, openSupportCases: openSupport, activeIncidents, cohorts,
    };
  });
}
