import { z } from "zod";
import { withCompanyContext } from "@ax-finance/db";
import { assertActiveMembership } from "../companies/assert-membership";
import { settlementCashDelta } from "../titles/settlement-cash-delta";
import { companyToday } from "../shared/today";

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const dashboardInsightsInput = z.object({
  from: dateOnly,
  to: dateOnly,
  comparisonFrom: dateOnly.optional(),
  comparisonTo: dateOnly.optional(),
  today: dateOnly.optional(),
});

/** Naturezas que formam o resultado operacional (mesma regra do DRE gerencial). */
const OPERATING_NATURES = new Set(["OPERATING_REVENUE", "COST", "EXPENSE"]);
const MONTHS_IN_SERIES = 6;
const HEALTH_WINDOW_DAYS = 90;
const ZERO = BigInt(0);

export interface ResultSummary {
  revenueCents: bigint;
  expenseCents: bigint;
  resultCents: bigint;
  /** Resultado ÷ receita, em pontos-base (1250 = 12,5%); null sem receita. */
  marginBps: number | null;
}

export interface CategoryShare {
  categoryId: string;
  name: string;
  cents: bigint;
  /** Fatia do total, em pontos-base. */
  shareBps: number;
}

const atUtc = (value: string) => new Date(`${value}T00:00:00Z`);
const asDate = (value: Date) => value.toISOString().slice(0, 10);

function addDays(value: string, days: number): string {
  const date = atUtc(value);
  date.setUTCDate(date.getUTCDate() + days);
  return asDate(date);
}

function monthKey(value: string): string {
  return value.slice(0, 7);
}

function shiftMonth(key: string, delta: number): string {
  const [year, month] = key.split("-").map(Number) as [number, number];
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function bps(part: bigint, total: bigint): number {
  return total > ZERO ? Number((part * BigInt(10_000)) / total) : 0;
}

function summarize(lines: Line[], from: string, to: string): ResultSummary {
  let revenueCents = ZERO;
  let expenseCents = ZERO;
  for (const line of lines) {
    if (line.date < from || line.date > to) continue;
    if (line.kind === "R") revenueCents += line.cents;
    else expenseCents += line.cents;
  }
  const resultCents = revenueCents - expenseCents;
  return { revenueCents, expenseCents, resultCents, marginBps: revenueCents > ZERO ? Number((resultCents * BigInt(10_000)) / revenueCents) : null };
}

interface Line {
  date: string;
  kind: "R" | "E";
  cents: bigint;
  category: { id: string; name: string };
  partyId: string | null;
  partyName: string | null;
}

function topShares(totals: Map<string, { name: string; cents: bigint }>, limit: number): CategoryShare[] {
  const rows = [...totals.entries()]
    .map(([categoryId, value]) => ({ categoryId, name: value.name, cents: value.cents }))
    .filter((row) => row.cents > ZERO)
    .sort((left, right) => (right.cents > left.cents ? 1 : right.cents < left.cents ? -1 : 0));
  const total = rows.reduce((sum, row) => sum + row.cents, ZERO);
  const visible = rows.slice(0, limit);
  const rest = rows.slice(limit).reduce((sum, row) => sum + row.cents, ZERO);
  const result = visible.map((row) => ({ ...row, shareBps: bps(row.cents, total) }));
  if (rest > ZERO) result.push({ categoryId: "others", name: "Outras", cents: rest, shareBps: bps(rest, total) });
  return result;
}

/**
 * Indicadores de gestão do dashboard, sempre de TODA a empresa (não seguem os filtros de conta,
 * categoria etc. do painel):
 *  - resultado por COMPETÊNCIA (receita − despesa operacional), no período e na comparação, com a
 *    série dos últimos 6 meses. Mesmo critério do DRE: valor original, sem cancelados, com rateio,
 *    sem o título da fatura de cartão e com as compras no cartão pela categoria de cada uma;
 *  - de onde veio a receita e para onde foi a despesa, por categoria (o cartão aparece pela categoria
 *    real das compras, não como "fatura");
 *  - saúde do caixa: inadimplência, prazos médios de recebimento e pagamento (últimos 90 dias),
 *    saída média diária e concentração da receita no maior cliente.
 * Só leitura; nada aqui bloqueia ou altera lançamentos.
 */
export async function getDashboardInsights(userId: string, companyId: string, input: unknown) {
  const data = dashboardInsightsInput.parse(input);
  await assertActiveMembership(userId, companyId);

  return withCompanyContext(userId, companyId, async (tx) => {
    const today = data.today ?? (await companyToday(tx, companyId));
    const lastMonth = monthKey(data.to);
    const monthKeys = Array.from({ length: MONTHS_IN_SERIES }, (_, index) => shiftMonth(lastMonth, index - (MONTHS_IN_SERIES - 1)));
    const seriesFrom = `${monthKeys[0]}-01`;
    const seriesTo = addDays(`${shiftMonth(lastMonth, 1)}-01`, -1);

    const candidatesFrom = [seriesFrom, data.from, data.comparisonFrom].filter(Boolean) as string[];
    const candidatesTo = [seriesTo, data.to, data.comparisonTo].filter(Boolean) as string[];
    const rangeFrom = candidatesFrom.reduce((min, value) => (value < min ? value : min));
    const rangeTo = candidatesTo.reduce((max, value) => (value > max ? value : max));
    const competence = { gte: atUtc(rangeFrom), lte: atUtc(rangeTo) };
    const categorySelect = { select: { id: true, name: true, nature: true } } as const;

    const healthFrom = addDays(today, -HEALTH_WINDOW_DAYS);
    const [titles, purchases, openReceivables, settlements] = await Promise.all([
      tx.title.findMany({
        where: { companyId, deletedAt: null, status: { not: "CANCELLED" }, competenceDate: competence, creditCardInvoice: null },
        select: {
          type: true, competenceDate: true, originalAmountCents: true,
          party: { select: { id: true, name: true } },
          category: categorySelect,
          allocations: { select: { amountCents: true, category: categorySelect } },
        },
      }),
      tx.creditCardPurchase.findMany({
        where: { companyId, canceledAt: null, competenceDate: competence },
        select: { competenceDate: true, amountCents: true, category: categorySelect },
      }),
      tx.title.findMany({
        where: { companyId, type: "RECEIVABLE", deletedAt: null, status: { in: ["OPEN", "PARTIALLY_SETTLED"] } },
        select: { dueDate: true, originalAmountCents: true, settlements: { where: { reversedAt: null }, select: { principalAmountCents: true, discountCents: true } } },
      }),
      tx.settlement.findMany({
        where: { companyId, reversedAt: null, effectiveDate: { gte: atUtc(healthFrom), lte: atUtc(today) } },
        select: {
          effectiveDate: true, principalAmountCents: true, interestPenaltyCents: true, feesCents: true,
          title: { select: { type: true, competenceDate: true, creditCardInvoice: { select: { id: true } } } },
        },
      }),
    ]);

    const lines: Line[] = [];
    const push = (date: Date, type: "RECEIVABLE" | "PAYABLE", category: { id: string; name: string; nature: string }, cents: bigint, party: { id: string; name: string } | null) => {
      if (!OPERATING_NATURES.has(category.nature)) return;
      lines.push({ date: asDate(date), kind: type === "RECEIVABLE" ? "R" : "E", cents, category: { id: category.id, name: category.name }, partyId: party?.id ?? null, partyName: party?.name ?? null });
    };
    for (const title of titles) {
      if (title.allocations.length > 0) for (const line of title.allocations) push(title.competenceDate, title.type, line.category, line.amountCents, title.party);
      else push(title.competenceDate, title.type, title.category, title.originalAmountCents, title.party);
    }
    for (const purchase of purchases) push(purchase.competenceDate, "PAYABLE", purchase.category, purchase.amountCents, null);

    const period = summarize(lines, data.from, data.to);
    const comparison = data.comparisonFrom && data.comparisonTo ? summarize(lines, data.comparisonFrom, data.comparisonTo) : null;
    const monthly = monthKeys.map((key) => {
      const summary = summarize(lines, `${key}-01`, `${key}-31`);
      return { month: key, revenueCents: summary.revenueCents, expenseCents: summary.expenseCents, resultCents: summary.resultCents };
    });

    const expenseTotals = new Map<string, { name: string; cents: bigint }>();
    const revenueTotals = new Map<string, { name: string; cents: bigint }>();
    const clientTotals = new Map<string, { name: string; cents: bigint }>();
    for (const line of lines) {
      if (line.date < data.from || line.date > data.to) continue;
      const bucket = line.kind === "R" ? revenueTotals : expenseTotals;
      const entry = bucket.get(line.category.id) ?? { name: line.category.name, cents: ZERO };
      entry.cents += line.cents;
      bucket.set(line.category.id, entry);
      if (line.kind === "R" && line.partyId) {
        const client = clientTotals.get(line.partyId) ?? { name: line.partyName ?? "Cliente", cents: ZERO };
        client.cents += line.cents;
        clientTotals.set(line.partyId, client);
      }
    }
    const topClient = [...clientTotals.values()].sort((left, right) => (right.cents > left.cents ? 1 : -1))[0];

    let openReceivableCents = ZERO;
    let overdueReceivableCents = ZERO;
    for (const title of openReceivables) {
      const settled = title.settlements.reduce((sum, row) => sum + row.principalAmountCents + row.discountCents, ZERO);
      const remaining = title.originalAmountCents - settled;
      if (remaining <= ZERO) continue;
      openReceivableCents += remaining;
      if (asDate(title.dueDate) < today) overdueReceivableCents += remaining;
    }

    let outflowCents = ZERO;
    const days = { RECEIVABLE: { weighted: ZERO, weight: ZERO }, PAYABLE: { weighted: ZERO, weight: ZERO } };
    for (const settlement of settlements) {
      const type = settlement.title.type;
      if (type === "PAYABLE") outflowCents += -settlementCashDelta(type, settlement);
      // Prazo médio: dias entre a competência e a baixa, ponderado pelo valor. A fatura de cartão fica de
      // fora do prazo de pagamento: o título dela nasce na 1ª compra do ciclo e distorceria a média.
      if (type === "PAYABLE" && settlement.title.creditCardInvoice) continue;
      const elapsed = Math.max(0, Math.round((settlement.effectiveDate.getTime() - settlement.title.competenceDate.getTime()) / 86_400_000));
      days[type].weighted += BigInt(elapsed) * settlement.principalAmountCents;
      days[type].weight += settlement.principalAmountCents;
    }
    const average = (entry: { weighted: bigint; weight: bigint }) => (entry.weight > ZERO ? Math.round(Number(entry.weighted / entry.weight)) : null);

    return {
      today,
      period,
      comparison,
      monthly,
      expenseByCategory: topShares(expenseTotals, 6),
      revenueByCategory: topShares(revenueTotals, 5),
      health: {
        openReceivableCents,
        overdueReceivableCents,
        delinquencyBps: bps(overdueReceivableCents, openReceivableCents),
        averageReceiveDays: average(days.RECEIVABLE),
        averagePayDays: average(days.PAYABLE),
        /** Saída de caixa dos últimos 90 dias (pagamentos, inclusive de fatura de cartão). */
        outflow90Cents: outflowCents,
        topClient: topClient ? { name: topClient.name, cents: topClient.cents, shareBps: bps(topClient.cents, period.revenueCents) } : null,
      },
    };
  });
}
