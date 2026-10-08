import type { TenantScopedClient } from "@ax-finance/db";
import { withCompanyContext } from "@ax-finance/db";
import { assertActiveMembership } from "../companies/assert-membership";
import { OPERATIONAL_ACCOUNT } from "./operational";

/**
 * Saldo por conta = saldo inicial + movimentos efetivados (Seção 18). Nesta
 * etapa os "movimentos" são baixas de título, transferências e ajustes
 * manuais de saldo — reconstruído a partir dos registros de origem a cada
 * leitura, nunca de um contador incremental guardado (regra 11: caches não
 * são fonte oficial).
 *
 * Efeito de caixa de uma baixa: mesma regra de `settlementCashDelta` (usada
 * pelo relatório de fluxo de caixa), aplicada aqui em SQL para somar no banco.
 *
 * Efeito de uma transferência (Seção 30): origem −(valor + tarifa), destino
 * +valor — a soma das duas contas só muda pela tarifa.
 *
 * Exportado (não só usado internamente) porque `createBalanceAdjustment`
 * precisa do saldo atual de uma conta especifica DENTRO da mesma transação
 * que vai criar o ajuste, pra calcular o delta a partir do saldo alvo
 * informado — chamar `listFinancialAccountsWithBalance` abriria uma
 * transação própria, fora da que trava/grava o ajuste.
 */
export async function computeAccountBalanceDeltas(
  tx: TenantScopedClient,
  companyId: string,
  asOfDate?: Date
): Promise<Map<string, bigint>> {
  // Somas feitas no banco, agrupadas por conta: cada leitura devolve uma linha por conta em vez de
  // trazer todas as baixas, devoluções, transferências e ajustes da empresa para somar em memória.
  // A data limite vai como texto "YYYY-MM-DD" (coluna é `date`, sem fuso). NULL = sem limite.
  const asOf = asOfDate ? asOfDate.toISOString().slice(0, 10) : null;

  const [settlements, refunds, transfersOut, transfersIn, adjustments] = await Promise.all([
    // Efeito de caixa da baixa: mesma regra de `settlementCashDelta`, escrita em SQL.
    tx.$queryRaw<{ account_id: string; cents: bigint }[]>`
      SELECT s."financial_account_id" AS account_id,
             COALESCE(SUM(CASE WHEN t."type" = 'RECEIVABLE'
               THEN s."principal_amount_cents" + s."interest_penalty_cents" - s."fees_cents"
               ELSE -(s."principal_amount_cents" + s."interest_penalty_cents" + s."fees_cents") END), 0)::bigint AS cents
      FROM "settlements" s
      JOIN "titles" t ON t."id" = s."title_id"
      WHERE s."company_id" = ${companyId} AND s."reversed_at" IS NULL
        AND (${asOf}::text IS NULL OR s."effective_date" <= ${asOf}::date)
      GROUP BY s."financial_account_id"`,
    // Devolução move o dinheiro no sentido oposto ao da baixa original.
    tx.$queryRaw<{ account_id: string; cents: bigint }[]>`
      SELECT r."financial_account_id" AS account_id,
             COALESCE(SUM(CASE WHEN t."type" = 'RECEIVABLE' THEN -r."amount_cents" ELSE r."amount_cents" END), 0)::bigint AS cents
      FROM "settlement_refunds" r
      JOIN "settlements" s ON s."id" = r."settlement_id"
      JOIN "titles" t ON t."id" = s."title_id"
      WHERE r."company_id" = ${companyId} AND r."reversed_at" IS NULL
        AND (${asOf}::text IS NULL OR r."effective_date" <= ${asOf}::date)
      GROUP BY r."financial_account_id"`,
    // Transferência: origem perde valor + tarifa, destino ganha o valor.
    tx.$queryRaw<{ account_id: string; cents: bigint }[]>`
      SELECT "from_account_id" AS account_id, COALESCE(SUM(-("amount_cents" + "fee_cents")), 0)::bigint AS cents
      FROM "transfers"
      WHERE "company_id" = ${companyId} AND "reversed_at" IS NULL
        AND (${asOf}::text IS NULL OR "transfer_date" <= ${asOf}::date)
      GROUP BY "from_account_id"`,
    tx.$queryRaw<{ account_id: string; cents: bigint }[]>`
      SELECT "to_account_id" AS account_id, COALESCE(SUM("amount_cents"), 0)::bigint AS cents
      FROM "transfers"
      WHERE "company_id" = ${companyId} AND "reversed_at" IS NULL
        AND (${asOf}::text IS NULL OR "transfer_date" <= ${asOf}::date)
      GROUP BY "to_account_id"`,
    tx.$queryRaw<{ account_id: string; cents: bigint }[]>`
      SELECT "financial_account_id" AS account_id, COALESCE(SUM("amount_cents"), 0)::bigint AS cents
      FROM "balance_adjustments"
      WHERE "company_id" = ${companyId} AND "reversed_at" IS NULL
        AND (${asOf}::text IS NULL OR "effective_date" <= ${asOf}::date)
      GROUP BY "financial_account_id"`,
  ]);

  const deltas = new Map<string, bigint>();
  for (const rows of [settlements, refunds, transfersOut, transfersIn, adjustments]) {
    for (const row of rows) {
      deltas.set(row.account_id, (deltas.get(row.account_id) ?? BigInt(0)) + row.cents);
    }
  }
  return deltas;
}

export async function listFinancialAccountsWithBalance(userId: string, companyId: string) {
  await assertActiveMembership(userId, companyId);

  return withCompanyContext(userId, companyId, async (tx) => {
    const accounts = await tx.financialAccount.findMany({
      where: { companyId, ...OPERATIONAL_ACCOUNT },
      orderBy: { createdAt: "asc" },
    });

    const deltas = await computeAccountBalanceDeltas(tx, companyId);

    return accounts.map((account) => ({
      ...account,
      currentBalanceCents: account.openingBalanceCents + (deltas.get(account.id) ?? BigInt(0)),
    }));
  });
}
