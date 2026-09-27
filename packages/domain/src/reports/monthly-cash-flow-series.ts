import { withCompanyContext } from "@ax-finance/db";
import { assertActiveMembership } from "../companies/assert-membership";
import { settlementCashDelta } from "../titles/settlement-cash-delta";

const MONTH_LABEL = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Série mensal de entradas vs saídas para o gráfico do dashboard (Seção 5):
 * soma o efeito de caixa (mesma fórmula de settlement-cash-delta.ts) das
 * baixas não estornadas dos `months` meses terminando em `endMonth` (default
 * o mês atual), em valor absoluto por tipo — duas magnitudes positivas
 * (recebido/pago), não um delta líquido que poderia ficar negativo e
 * distorcer o gráfico de linha.
 */
export async function getMonthlyCashFlowSeries(
  userId: string,
  companyId: string,
  { months = 6, endMonth }: { months?: number; endMonth?: string } = {}
) {
  await assertActiveMembership(userId, companyId);

  const now = new Date();
  const [endYear, endMonthIndex] = endMonth
    ? endMonth.split("-").map(Number)
    : [now.getUTCFullYear(), now.getUTCMonth() + 1];
  const from = new Date(Date.UTC(endYear!, endMonthIndex! - 1 - (months - 1), 1));
  const to = new Date(Date.UTC(endYear!, endMonthIndex!, 1));

  const { settlements, refunds } = await withCompanyContext(userId, companyId, async (tx) => ({
    settlements: await tx.settlement.findMany({
      where: { companyId, reversedAt: null, effectiveDate: { gte: from, lt: to } },
      include: { title: { select: { type: true } } },
    }),
    refunds: await tx.settlementRefund.findMany({ where: { companyId, reversedAt: null, effectiveDate: { gte: from, lt: to } }, include: { settlement: { include: { title: { select: { type: true } } } } } }),
  }));

  const buckets = new Map<string, { entradasCents: bigint; saidasCents: bigint }>();
  for (let i = 0; i < months; i++) {
    const date = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + i, 1));
    buckets.set(monthKey(date), { entradasCents: BigInt(0), saidasCents: BigInt(0) });
  }

  for (const settlement of settlements) {
    const key = monthKey(settlement.effectiveDate);
    const bucket = buckets.get(key);
    if (!bucket) continue;

    const delta = settlementCashDelta(settlement.title.type, settlement);
    if (settlement.title.type === "RECEIVABLE") {
      bucket.entradasCents += delta;
    } else {
      bucket.saidasCents += -delta;
    }
  }
  for (const refund of refunds) {
    const bucket = buckets.get(monthKey(refund.effectiveDate));
    if (!bucket) continue;
    if (refund.settlement.title.type === "RECEIVABLE") bucket.entradasCents -= refund.amountCents;
    else bucket.saidasCents -= refund.amountCents;
  }

  return Array.from(buckets.entries()).map(([key, bucket]) => {
    const [, month] = key.split("-");
    const label = MONTH_LABEL[Number(month) - 1] ?? "";
    return {
      month: label,
      entradas: Number(bucket.entradasCents) / 100,
      saidas: Number(bucket.saidasCents) / 100,
    };
  });
}
