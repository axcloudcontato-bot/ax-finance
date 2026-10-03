import { withCompanyContext } from "@ax-finance/db";
import { assertActiveMembership } from "../companies/assert-membership";
import { assertCompanyPlanFeature } from "../subscriptions/plan-features";

export interface ListAuditEventsFilter {
  resourceType?: string;
  resourceId?: string;
  from?: string;
  to?: string;
}

export async function listAuditEvents(userId: string, companyId: string, filter: ListAuditEventsFilter = {}) {
  await assertActiveMembership(userId, companyId);
  await assertCompanyPlanFeature(userId, companyId, "AUDIT_LOG");

  const events = await withCompanyContext(userId, companyId, (tx) =>
    tx.auditEvent.findMany({
      where: {
        companyId,
        ...(filter.resourceType ? { resourceType: filter.resourceType } : {}),
        ...(filter.resourceId ? { resourceId: filter.resourceId } : {}),
        ...(filter.from || filter.to
          ? {
              createdAt: {
                ...(filter.from ? { gte: new Date(filter.from) } : {}),
                ...(filter.to ? { lte: new Date(`${filter.to}T23:59:59.999Z`) } : {}),
              },
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
    })
  );

  const actorIds = Array.from(new Set(events.map((event) => event.actorUserId)));
  const actors = await withCompanyContext(userId, companyId, (tx) =>
    tx.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } })
  );
  const actorNameById = new Map(actors.map((actor) => [actor.id, actor.name]));

  return events.map((event) => ({
    ...event,
    actorName: actorNameById.get(event.actorUserId) ?? (event.actorUserId === "system:stripe" ? "Stripe" : "Usuário removido"),
  }));
}
