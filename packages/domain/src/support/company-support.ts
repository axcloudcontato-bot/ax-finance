import { z } from "zod";
import { withCompanyContext } from "@ax-finance/db";
import { assertActiveMembership } from "../companies/assert-membership";

const customerSupportInput = z.object({
  subject: z.string().trim().min(5).max(200),
  summary: z.string().trim().min(20).max(4000),
  contactEmail: z.string().trim().email().max(200),
  priority: z.enum(["LOW", "NORMAL", "HIGH"]).default("NORMAL"),
});

export async function listCompanySupportCases(userId: string, companyId: string) {
  await assertActiveMembership(userId, companyId);
  return withCompanyContext(userId, companyId, (tx) => tx.supportCase.findMany({
    where: { companyId },
    select: { id: true, subject: true, summary: true, priority: true, status: true, resolution: true, createdAt: true, updatedAt: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  }));
}

export async function createCompanySupportCase(userId: string, companyId: string, input: unknown) {
  const data = customerSupportInput.parse(input);
  await assertActiveMembership(userId, companyId);
  return withCompanyContext(userId, companyId, (tx) => tx.supportCase.create({
    data: { ...data, companyId, createdByUserId: userId },
  }));
}
