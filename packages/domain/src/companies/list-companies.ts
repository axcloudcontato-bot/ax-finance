import { withUserContext } from "@ax-finance/db";

/**
 * Empresas às quais o usuário tem associação ativa. O filtro por membership
 * já acontece aqui na query (defesa de aplicação) e é reforçado pela RLS de
 * `companies` no banco (defesa em profundidade) — nenhuma das duas camadas
 * sozinha é o único ponto de confiança.
 */
export async function listCompaniesForUser(userId: string) {
  return withUserContext(userId, (tx) =>
    tx.company.findMany({
      where: {
        memberships: {
          some: { userId, status: "ACTIVE" },
        },
      },
      orderBy: { createdAt: "asc" },
    })
  );
}
