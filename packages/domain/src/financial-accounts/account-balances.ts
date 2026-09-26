import { withCompanyContext } from "@ax-finance/db";
import { assertActiveMembership } from "../companies/assert-membership";
import { settlementCashDelta } from "../titles/settlement-cash-delta";

/**
 * Saldo por conta = saldo inicial + movimentos efetivados (Seção 18). Nesta
 * etapa os "movimentos" são baixas de título e transferências — reconstruído
 * a partir dos registros de origem a cada leitura, nunca de um contador
 * incremental guardado (regra 11: caches não são fonte oficial).
 *
 * Efeito de caixa de uma baixa: ver `settlementCashDelta` (mesma regra usada
 * pelo relatório de fluxo de caixa).
 *
 * Efeito de uma transferência (Seção 30): origem −(valor + tarifa), destino
 * +valor — a soma das duas contas só muda pela tarifa.
 */
export async function listFinancialAccountsWithBalance(userId: string, companyId: string) {
  await assertActiveMembership(userId, companyId);

  return withCompanyContext(userId, companyId, async (tx) => {
    const accounts = await tx.financialAccount.findMany({
      where: { companyId },
      orderBy: { createdAt: "asc" },
    });

    const settlements = await tx.settlement.findMany({
      where: { companyId, reversedAt: null },
      include: { title: { select: { type: true } } },
    });

    const transfers = await tx.transfer.findMany({
      where: { companyId, reversedAt: null },
    });

    const deltas = new Map<string, bigint>();
    const add = (accountId: string, amountCents: bigint) => {
      deltas.set(accountId, (deltas.get(accountId) ?? BigInt(0)) + amountCents);
    };

    for (const settlement of settlements) {
      add(settlement.financialAccountId, settlementCashDelta(settlement.title.type, settlement));
    }

    for (const transfer of transfers) {
      add(transfer.fromAccountId, -(transfer.amountCents + transfer.feeCents));
      add(transfer.toAccountId, transfer.amountCents);
    }

    return accounts.map((account) => ({
      ...account,
      currentBalanceCents: account.openingBalanceCents + (deltas.get(account.id) ?? BigInt(0)),
    }));
  });
}
