import { z } from "zod";
import { withUserContext } from "@ax-finance/db";
import { IncidentNotFoundError, SupportCaseNotFoundError } from "../errors";
import { assertPlatformAdminInTx, recordAdminAudit } from "./access";

export async function listAdminSupport(userId: string) {
  return withUserContext(userId, async (tx) => {
    await assertPlatformAdminInTx(tx, userId);
    const [cases, incidents, admins, companies] = await Promise.all([
      tx.supportCase.findMany({ include: { company: { select: { id: true, name: true } }, assignedTo: { select: { id: true, name: true } }, createdBy: { select: { name: true } } }, orderBy: [{ status: "asc" }, { priority: "desc" }, { createdAt: "desc" }], take: 200 }),
      tx.incident.findMany({ include: { company: { select: { id: true, name: true } }, createdBy: { select: { name: true } } }, orderBy: [{ status: "asc" }, { severity: "asc" }, { startedAt: "desc" }], take: 100 }),
      tx.platformAdmin.findMany({ where: { active: true }, include: { user: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "asc" } }),
      tx.company.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true }, orderBy: { name: "asc" }, take: 500 }),
    ]);
    return { cases, incidents, admins, companies };
  });
}

const createCaseInput = z.object({
  companyId: z.string().uuid().optional(), subject: z.string().trim().min(1).max(200), summary: z.string().trim().min(1).max(4000),
  contactEmail: z.string().trim().email().max(200).optional(), priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"), assignedToUserId: z.string().uuid().optional(),
});
export async function createSupportCase(userId: string, input: unknown) {
  const data = createCaseInput.parse(input);
  return withUserContext(userId, async (tx) => {
    await assertPlatformAdminInTx(tx, userId, ["SUPER_ADMIN", "SUPPORT", "OPERATIONS"]);
    const created = await tx.supportCase.create({ data: { ...data, createdByUserId: userId } });
    await recordAdminAudit(tx, { actorUserId: userId, action: "SUPPORT_CASE_CREATED", targetType: "SupportCase", targetId: created.id, summary: created.subject });
    return created;
  });
}

const updateCaseInput = z.object({ status: z.enum(["OPEN", "IN_PROGRESS", "WAITING_CUSTOMER", "RESOLVED", "CLOSED"]), priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]), assignedToUserId: z.string().uuid().optional(), resolution: z.string().trim().max(4000).optional() });
export async function updateSupportCase(userId: string, caseId: string, input: unknown) {
  const data = updateCaseInput.parse(input);
  return withUserContext(userId, async (tx) => {
    await assertPlatformAdminInTx(tx, userId, ["SUPER_ADMIN", "SUPPORT", "OPERATIONS"]);
    if (!(await tx.supportCase.findUnique({ where: { id: caseId } }))) throw new SupportCaseNotFoundError();
    const resolved = data.status === "RESOLVED" || data.status === "CLOSED";
    const updated = await tx.supportCase.update({ where: { id: caseId }, data: { ...data, assignedToUserId: data.assignedToUserId ?? null, resolution: data.resolution || null, resolvedAt: resolved ? new Date() : null } });
    await recordAdminAudit(tx, { actorUserId: userId, action: "SUPPORT_CASE_UPDATED", targetType: "SupportCase", targetId: caseId, summary: `Status alterado para ${data.status}` });
    return updated;
  });
}

const createIncidentInput = z.object({ companyId: z.string().uuid().optional(), title: z.string().trim().min(1).max(200), severity: z.enum(["SEV1", "SEV2", "SEV3", "SEV4"]), publicMessage: z.string().trim().min(1).max(2000), internalSummary: z.string().trim().max(4000).optional() });
export async function createIncident(userId: string, input: unknown) {
  const data = createIncidentInput.parse(input);
  return withUserContext(userId, async (tx) => {
    await assertPlatformAdminInTx(tx, userId, ["SUPER_ADMIN", "OPERATIONS", "SUPPORT"]);
    const created = await tx.incident.create({ data: { ...data, createdByUserId: userId } });
    await recordAdminAudit(tx, { actorUserId: userId, action: "INCIDENT_CREATED", targetType: "Incident", targetId: created.id, summary: created.title, metadata: { severity: created.severity } });
    return created;
  });
}

const updateIncidentInput = z.object({ status: z.enum(["INVESTIGATING", "IDENTIFIED", "MONITORING", "RESOLVED"]), severity: z.enum(["SEV1", "SEV2", "SEV3", "SEV4"]), publicMessage: z.string().trim().min(1).max(2000), internalSummary: z.string().trim().max(4000).optional() });
export async function updateIncident(userId: string, incidentId: string, input: unknown) {
  const data = updateIncidentInput.parse(input);
  return withUserContext(userId, async (tx) => {
    await assertPlatformAdminInTx(tx, userId, ["SUPER_ADMIN", "OPERATIONS", "SUPPORT"]);
    if (!(await tx.incident.findUnique({ where: { id: incidentId } }))) throw new IncidentNotFoundError();
    const updated = await tx.incident.update({ where: { id: incidentId }, data: { ...data, internalSummary: data.internalSummary || null, resolvedAt: data.status === "RESOLVED" ? new Date() : null } });
    await recordAdminAudit(tx, { actorUserId: userId, action: "INCIDENT_UPDATED", targetType: "Incident", targetId: incidentId, summary: `Status alterado para ${data.status}` });
    return updated;
  });
}
