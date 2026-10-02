import { z } from "zod";
import { withUserContext } from "@ax-finance/db";
import { assertPlatformAdminInTx, recordAdminAudit } from "./access";
import { loadAdminCompanyStats } from "./company-stats";

const listInput = z.object({
  search: z.string().trim().max(200).optional(),
  subscriptionStatus: z.enum(["TRIAL", "ACTIVE", "PAYMENT_PENDING", "GRACE_PERIOD", "SUSPENDED", "CANCELLATION_SCHEDULED", "CANCELLED"]).optional(),
  companyStatus: z.enum(["ACTIVE", "ARCHIVED"]).optional(),
}).default({});

export async function listAdminCompanies(userId: string, input: unknown = {}) {
  const data = listInput.parse(input);
  return withUserContext(userId, async (tx) => {
    await assertPlatformAdminInTx(tx, userId);
    const companies = await tx.company.findMany({
      where: {
        ...(data.search ? { OR: [{ name: { contains: data.search, mode: "insensitive" } }, { document: { contains: data.search, mode: "insensitive" } }] } : {}),
        ...(data.companyStatus ? { status: data.companyStatus } : {}),
        ...(data.subscriptionStatus ? { subscription: { status: data.subscriptionStatus } } : {}),
      },
      include: {
        subscription: true,
        memberships: { where: { role: "OWNER", status: "ACTIVE" }, include: { user: { select: { name: true, email: true } } }, take: 1 },
        _count: { select: { memberships: true, importBatches: true, supportCases: true } },
      },
      orderBy: { createdAt: "desc" }, take: 200,
    });
    const stats = await loadAdminCompanyStats(tx);
    return companies.map((company) => ({
      ...company,
      owner: company.memberships[0]?.user ?? null,
      memberships: undefined,
      _count: {
        ...company._count,
        financialAccounts: stats.get(company.id)?.accounts ?? 0,
        titles: stats.get(company.id)?.titles ?? 0,
      },
    }));
  });
}

const updateSubscriptionInput = z.object({
  status: z.enum(["TRIAL", "ACTIVE", "PAYMENT_PENDING", "GRACE_PERIOD", "SUSPENDED", "CANCELLATION_SCHEDULED", "CANCELLED"]),
  planCode: z.string().trim().min(1).max(50),
  trialEndsAt: z.coerce.date().optional(),
  currentPeriodEnd: z.coerce.date().optional(),
  graceEndsAt: z.coerce.date().optional(),
  cancellationEffectiveAt: z.coerce.date().optional(),
  reason: z.string().trim().min(1).max(500),
});

export async function updateAdminSubscription(userId: string, companyId: string, input: unknown) {
  const data = updateSubscriptionInput.parse(input);
  return withUserContext(userId, async (tx) => {
    await assertPlatformAdminInTx(tx, userId, ["SUPER_ADMIN"]);
    const previous = await tx.subscription.findUnique({ where: { companyId } });
    if (!previous) throw new Error("Assinatura não encontrada.");
    const updated = await tx.subscription.update({ where: { companyId }, data: {
      status: data.status, planCode: data.planCode,
      trialEndsAt: data.trialEndsAt ?? null, currentPeriodEnd: data.currentPeriodEnd ?? null,
      graceEndsAt: data.graceEndsAt ?? null, cancellationEffectiveAt: data.cancellationEffectiveAt ?? null,
    } });
    await recordAdminAudit(tx, { actorUserId: userId, action: "SUBSCRIPTION_UPDATED", targetType: "Company", targetId: companyId, summary: data.reason, metadata: { previousStatus: previous.status, newStatus: updated.status, previousPlan: previous.planCode, newPlan: updated.planCode } });
    return updated;
  });
}
