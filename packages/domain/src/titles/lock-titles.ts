import type { TenantScopedClient } from "@ax-finance/db";

/** A mesma trava das baixas evita editar, cancelar ou excluir enquanto alguém paga. */
export async function lockTitles(tx: TenantScopedClient, companyId: string, titleIds: string[]) {
  const ids = [...new Set(titleIds)].sort();
  await tx.$queryRaw`
    SELECT id FROM "titles"
    WHERE company_id = ${companyId} AND id = ANY(${ids}::text[]) AND deleted_at IS NULL
    ORDER BY id FOR UPDATE
  `;
}
