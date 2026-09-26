import { withUserContext } from "@ax-finance/db";
import { CompanyAccessDeniedError } from "../errors";

/**
 * Ponto único de verificação de acesso a uma empresa. Todo caso de uso
 * "dentro" de uma empresa (contas, e no futuro títulos/baixas/relatórios)
 * deve chamar isto antes de abrir o contexto de escrita/leitura com
 * `withCompanyContext`. Nunca diferencia "empresa não existe" de "empresa
 * existe mas você não tem acesso" — evita enumeração de ids de outras
 * empresas (Seção 17/22 do DIRECAO.md).
 */
export async function assertActiveMembership(userId: string, companyId: string) {
  const membership = await withUserContext(userId, (tx) =>
    tx.membership.findFirst({
      where: { userId, companyId, status: "ACTIVE" },
    })
  );

  if (!membership) {
    throw new CompanyAccessDeniedError();
  }

  return membership;
}
