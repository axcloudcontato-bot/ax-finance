import { withCompanyContext } from "@ax-finance/db";
import { assertActiveMembership } from "../companies/assert-membership";

/** Vencidos + vencendo hoje, mais recentes primeiro — usado pelo sino de notificações do topbar. */
export async function listDueSoonTitles(userId: string, companyId: string, limit = 8) {
  await assertActiveMembership(userId, companyId);

  const today = new Date().toISOString().slice(0, 10);

  return withCompanyContext(userId, companyId, (tx) =>
    tx.title.findMany({
      where: {
        companyId,
        status: { in: ["OPEN", "PARTIALLY_SETTLED"] },
        dueDate: { lte: new Date(`${today}T23:59:59.999Z`) },
      },
      orderBy: { dueDate: "asc" },
      take: limit,
    })
  );
}
