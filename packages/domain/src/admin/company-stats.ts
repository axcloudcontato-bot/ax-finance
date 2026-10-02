import type { Prisma } from "@ax-finance/db";

export type AdminCompanyStats = {
  createdAt: Date;
  accounts: number;
  titles: number;
  activeTitles: number;
};

/**
 * Contagens por empresa vindas de app_admin_company_stats(), que só responde a
 * platform admins. O painel interno não lê linhas de títulos, baixas ou contas:
 * as políticas de RLS que permitiam isso foram removidas
 * (20261002120000_admin_least_privilege).
 *
 * Os campos do $queryRaw são lidos como número porque o Postgres devolve BIGINT.
 */
export async function loadAdminCompanyStats(tx: Prisma.TransactionClient) {
  const rows = await tx.$queryRaw<
    Array<{
      company_id: string;
      created_at: Date;
      accounts_count: bigint;
      titles_count: bigint;
      active_titles_count: bigint;
    }>
  >`SELECT company_id, created_at, accounts_count, titles_count, active_titles_count FROM app_admin_company_stats()`;
  return new Map<string, AdminCompanyStats>(
    rows.map((row) => [
      row.company_id,
      {
        createdAt: row.created_at,
        accounts: Number(row.accounts_count),
        titles: Number(row.titles_count),
        activeTitles: Number(row.active_titles_count),
      },
    ])
  );
}
