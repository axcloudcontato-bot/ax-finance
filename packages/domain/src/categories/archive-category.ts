import { withCompanyContext } from "@ax-finance/db";
import { assertCompanyPermission } from "../companies/permissions";
import { CategoryNotFoundError } from "../errors";

/**
 * Desativar preserva histórico (Seção 9) — nunca é um DELETE. Uma categoria
 * arquivada continua aparecendo em títulos já lançados; só some do seletor
 * de novos lançamentos (listActiveCategories).
 */
export async function archiveCategory(userId: string, companyId: string, categoryId: string) {
  await assertCompanyPermission(userId, companyId, "CATALOG_WRITE");

  return withCompanyContext(userId, companyId, async (tx) => {
    const category = await tx.category.findFirst({ where: { id: categoryId, companyId } });
    if (!category) {
      throw new CategoryNotFoundError();
    }

    return tx.category.update({
      where: { id: categoryId },
      data: { status: "ARCHIVED" },
    });
  });
}
