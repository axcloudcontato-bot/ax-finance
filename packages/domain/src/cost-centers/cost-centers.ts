import { z } from "zod";
import { withCompanyContext } from "@ax-finance/db";
import { assertCompanyPermission } from "../companies/permissions";
import { CostCenterNotFoundError } from "../errors";
import { recordAuditEvent } from "../audit/record-audit-event";

export const createCostCenterInput = z.object({
  name: z.string().trim().min(1).max(200),
  code: z.string().trim().max(50).optional().transform((value) => value || undefined),
});

export async function listCostCenters(userId: string, companyId: string, includeArchived = false) {
  await assertCompanyPermission(userId, companyId, "FINANCE_READ");
  return withCompanyContext(userId, companyId, (tx) => tx.costCenter.findMany({
    where: { companyId, ...(includeArchived ? {} : { status: "ACTIVE" }) },
    orderBy: [{ status: "asc" }, { name: "asc" }],
  }));
}

export async function createCostCenter(userId: string, companyId: string, input: unknown) {
  const data = createCostCenterInput.parse(input);
  await assertCompanyPermission(userId, companyId, "CATALOG_WRITE");
  return withCompanyContext(userId, companyId, async (tx) => {
    const costCenter = await tx.costCenter.create({ data: { companyId, ...data } });
    await recordAuditEvent(tx, {
      companyId,
      actorUserId: userId,
      eventType: "COST_CENTER_CREATED",
      resourceType: "CostCenter",
      resourceId: costCenter.id,
      summary: costCenter.name,
      metadata: { code: costCenter.code },
    });
    return costCenter;
  });
}

export async function archiveCostCenter(userId: string, companyId: string, costCenterId: string) {
  await assertCompanyPermission(userId, companyId, "CATALOG_WRITE");
  return withCompanyContext(userId, companyId, async (tx) => {
    const costCenter = await tx.costCenter.findFirst({ where: { id: costCenterId, companyId } });
    if (!costCenter) throw new CostCenterNotFoundError();
    const archived = await tx.costCenter.update({ where: { id: costCenter.id }, data: { status: "ARCHIVED" } });
    await recordAuditEvent(tx, {
      companyId,
      actorUserId: userId,
      eventType: "COST_CENTER_ARCHIVED",
      resourceType: "CostCenter",
      resourceId: costCenter.id,
      summary: costCenter.name,
    });
    return archived;
  });
}
