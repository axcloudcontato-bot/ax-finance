import { withCompanyContext } from "@ax-finance/db";
import { assertActiveMembership } from "../companies/assert-membership";

export async function listCategories(userId: string, companyId: string) {
  await assertActiveMembership(userId, companyId);

  return withCompanyContext(userId, companyId, (tx) =>
    tx.category.findMany({
      where: { companyId },
      orderBy: [{ parentId: "asc" }, { order: "asc" }, { name: "asc" }],
    })
  );
}

/** Só categorias ativas, para preencher o seletor ao lançar um título. */
export async function listActiveCategories(userId: string, companyId: string) {
  await assertActiveMembership(userId, companyId);

  return withCompanyContext(userId, companyId, (tx) =>
    tx.category.findMany({
      where: { companyId, status: "ACTIVE" },
      orderBy: [{ parentId: "asc" }, { order: "asc" }, { name: "asc" }],
    })
  );
}
