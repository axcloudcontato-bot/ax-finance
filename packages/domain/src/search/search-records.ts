import { withCompanyContext } from "@ax-finance/db";
import { assertActiveMembership } from "../companies/assert-membership";

/**
 * Busca global do topbar — só títulos/pessoas/categorias (o que existe hoje
 * no P0). `contains`/`mode: insensitive` é simples e suficiente pro volume
 * de dados de uma empresa de serviços pequena; nada de índice de texto
 * completo por ora.
 */
export async function searchRecords(userId: string, companyId: string, query: string) {
  const q = query.trim();
  if (q.length < 2) {
    return { titles: [], parties: [], categories: [] };
  }

  await assertActiveMembership(userId, companyId);

  return withCompanyContext(userId, companyId, async (tx) => {
    const [titles, parties, categories] = await Promise.all([
      tx.title.findMany({
        where: { companyId, description: { contains: q, mode: "insensitive" } },
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
      tx.party.findMany({
        where: {
          companyId,
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { document: { contains: q, mode: "insensitive" } },
          ],
        },
        orderBy: { name: "asc" },
        take: 8,
      }),
      tx.category.findMany({
        where: { companyId, name: { contains: q, mode: "insensitive" } },
        orderBy: { name: "asc" },
        take: 8,
      }),
    ]);

    return { titles, parties, categories };
  });
}
