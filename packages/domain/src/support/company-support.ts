import { z } from "zod";
import { withCompanyContext } from "@ax-finance/db";
import { assertActiveMembership } from "../companies/assert-membership";
import { enqueueSupportCaseOpenedEmail } from "../outbox/events";

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

/**
 * Abre um chamado e, na mesma transação, enfileira o aviso por e-mail para a equipe interna
 * (super admin, operações e suporte ativos, resolvidos pelo worker no envio).
 */
export async function createCompanySupportCase(userId: string, companyId: string, input: unknown) {
  const data = customerSupportInput.parse(input);
  await assertActiveMembership(userId, companyId);
  return withCompanyContext(userId, companyId, async (tx) => {
    const created = await tx.supportCase.create({ data: { ...data, companyId, createdByUserId: userId } });
    const [company, user] = await Promise.all([
      tx.company.findUnique({ where: { id: companyId }, select: { name: true } }),
      tx.user.findUnique({ where: { id: userId }, select: { name: true } }),
    ]);
    await enqueueSupportCaseOpenedEmail(tx, `support-case-opened:${created.id}`, {
      caseId: created.id,
      companyName: company?.name ?? "Empresa",
      openedByName: user?.name ?? "Cliente",
      contactEmail: data.contactEmail,
      subject: data.subject,
      summary: data.summary,
      priority: data.priority,
    });
    return created;
  });
}
