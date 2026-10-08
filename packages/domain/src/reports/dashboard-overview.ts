import type { CategoryNature, Prisma } from "@ax-finance/db";
import { withCompanyContext } from "@ax-finance/db";
import { z } from "zod";
import { assertActiveMembership } from "../companies/assert-membership";
import { computeAccountBalanceDeltas } from "../financial-accounts/account-balances";
import { settlementCashDelta } from "../titles/settlement-cash-delta";
import { isPlanFeatureEnabled } from "../subscriptions/plan-features";
import { getCompanyToday } from "../shared/today";

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const dashboardOverviewInput = z.object({
  from: dateOnly,
  to: dateOnly,
  comparisonFrom: dateOnly.optional(),
  comparisonTo: dateOnly.optional(),
  today: dateOnly.optional(),
  financialAccountId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  partyId: z.string().uuid().optional(),
  costCenterId: z.string().uuid().optional(),
  /** Horizonte da projeção de caixa, em dias. */
  projectionDays: z.union([z.literal(30), z.literal(60), z.literal(90)]).default(30),
}).superRefine((value, context) => {
  if (value.from > value.to) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["to"], message: "Período inválido" });
  }
  if (Boolean(value.comparisonFrom) !== Boolean(value.comparisonTo)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["comparisonTo"], message: "Comparação incompleta" });
  }
  if (value.comparisonFrom && value.comparisonTo && value.comparisonFrom > value.comparisonTo) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["comparisonTo"], message: "Comparação inválida" });
  }
});

export type DashboardOverviewInput = z.infer<typeof dashboardOverviewInput>;

const DAY_MS = 86_400_000;
const OPERATING_PAYMENT_NATURES = new Set<CategoryNature>(["COST", "EXPENSE"]);

function atUtc(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function asDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function addDays(value: string, days: number): string {
  return asDateOnly(new Date(atUtc(value).getTime() + days * DAY_MS));
}

function titleFilter(data: DashboardOverviewInput): Prisma.TitleWhereInput {
  return {
    ...(data.categoryId ? { categoryId: data.categoryId } : {}),
    ...(data.partyId ? { partyId: data.partyId } : {}),
    ...(data.costCenterId ? { costCenterId: data.costCenterId } : {}),
  };
}

type SettlementRow = {
  id: string;
  effectiveDate: Date;
  principalAmountCents: bigint;
  discountCents: bigint;
  interestPenaltyCents: bigint;
  feesCents: bigint;
  financialAccount: { id: string; name: string };
  title: {
    id: string;
    type: "RECEIVABLE" | "PAYABLE";
    description: string;
    category: { id: string; name: string; nature: CategoryNature };
  };
};

type RefundRow = {
  id: string;
  effectiveDate: Date;
  amountCents: bigint;
  settlement: { title: SettlementRow["title"] };
};

function summarizeSettlements(rows: SettlementRow[], refunds: RefundRow[] = []) {
  let receivedCents = BigInt(0);
  let paidCents = BigInt(0);
  let operatingReceivedCents = BigInt(0);
  let operatingPaidCents = BigInt(0);

  for (const settlement of rows) {
    const delta = settlementCashDelta(settlement.title.type, settlement);
    if (settlement.title.type === "RECEIVABLE") {
      receivedCents += delta;
      if (settlement.title.category.nature === "OPERATING_REVENUE") operatingReceivedCents += delta;
    } else {
      const paid = -delta;
      paidCents += paid;
      if (OPERATING_PAYMENT_NATURES.has(settlement.title.category.nature)) operatingPaidCents += paid;
    }
  }

  for (const refund of refunds) {
    const title = refund.settlement.title;
    if (title.type === "RECEIVABLE") {
      receivedCents -= refund.amountCents;
      if (title.category.nature === "OPERATING_REVENUE") operatingReceivedCents -= refund.amountCents;
    } else {
      paidCents -= refund.amountCents;
      if (OPERATING_PAYMENT_NATURES.has(title.category.nature)) operatingPaidCents -= refund.amountCents;
    }
  }

  return {
    receivedCents,
    paidCents,
    operatingReceivedCents,
    operatingPaidCents,
    operatingNetCents: operatingReceivedCents - operatingPaidCents,
  };
}

function rangeContains(date: Date, from: string, to: string): boolean {
  const value = asDateOnly(date);
  return value >= from && value <= to;
}

function bucketStrategy(from: string, to: string) {
  const inclusiveDays = Math.floor((atUtc(to).getTime() - atUtc(from).getTime()) / DAY_MS) + 1;
  return inclusiveDays <= 62 ? "day" as const : "month" as const;
}

function bucketKey(value: Date | string, strategy: "day" | "month"): string {
  const day = typeof value === "string" ? value : asDateOnly(value);
  return strategy === "day" ? day : day.slice(0, 7);
}

function bucketLabel(key: string, strategy: "day" | "month"): string {
  if (strategy === "day") return `${key.slice(8, 10)}/${key.slice(5, 7)}`;
  const month = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${month[Number(key.slice(5, 7)) - 1]}/${key.slice(2, 4)}`;
}

function createFlowBuckets(from: string, to: string) {
  const strategy = bucketStrategy(from, to);
  const buckets = new Map<string, {
    key: string;
    label: string;
    realizedReceiptsCents: bigint;
    realizedPaymentsCents: bigint;
    forecastReceiptsCents: bigint;
    forecastPaymentsCents: bigint;
  }>();

  if (strategy === "day") {
    for (let cursor = from; cursor <= to; cursor = addDays(cursor, 1)) {
      buckets.set(cursor, {
        key: cursor,
        label: bucketLabel(cursor, strategy),
        realizedReceiptsCents: BigInt(0),
        realizedPaymentsCents: BigInt(0),
        forecastReceiptsCents: BigInt(0),
        forecastPaymentsCents: BigInt(0),
      });
    }
  } else {
    const start = atUtc(`${from.slice(0, 7)}-01`);
    const end = atUtc(`${to.slice(0, 7)}-01`);
    for (let cursor = start; cursor <= end; cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1))) {
      const key = asDateOnly(cursor).slice(0, 7);
      buckets.set(key, {
        key,
        label: bucketLabel(key, strategy),
        realizedReceiptsCents: BigInt(0),
        realizedPaymentsCents: BigInt(0),
        forecastReceiptsCents: BigInt(0),
        forecastPaymentsCents: BigInt(0),
      });
    }
  }

  return { strategy, buckets };
}

/**
 * Visão analítica do dashboard. Todos os dados passam pelo mesmo contexto RLS.
 * O filtro de conta se aplica a saldo, baixas e conciliação; títulos abertos
 * ainda não possuem conta prevista e, portanto, nunca são atribuídos a uma
 * conta por inferência.
 */
export async function getDashboardOverview(userId: string, companyId: string, input: unknown) {
  const data = dashboardOverviewInput.parse(input);
  await assertActiveMembership(userId, companyId);

  const today = data.today ?? (await getCompanyToday(userId, companyId));
  const projectionEnd = addDays(today, data.projectionDays);
  const comparisonRanges = data.comparisonFrom && data.comparisonTo
    ? [{ effectiveDate: { gte: atUtc(data.comparisonFrom), lte: atUtc(data.comparisonTo) } }]
    : [];
  const settlementRanges = [
    { effectiveDate: { gte: atUtc(data.from), lte: atUtc(data.to) } },
    ...comparisonRanges,
  ];

  return withCompanyContext(userId, companyId, async (tx) => {
    const subscription = await tx.subscription.findUnique({ where: { companyId }, select: { planCode: true } });
    const reconciliationAvailable = isPlanFeatureEnabled(subscription?.planCode, "BANK_RECONCILIATION");
    const [accounts, balanceDeltas, settlements, refunds, titles, pendingLines, failedImports] = await Promise.all([
      tx.financialAccount.findMany({
        where: { companyId, status: "ACTIVE", ...(data.financialAccountId ? { id: data.financialAccountId } : {}) },
        orderBy: { createdAt: "asc" },
      }),
      computeAccountBalanceDeltas(tx, companyId, atUtc(today)),
      tx.settlement.findMany({
        where: {
          companyId,
          reversedAt: null,
          OR: settlementRanges,
          ...(data.financialAccountId ? { financialAccountId: data.financialAccountId } : {}),
          title: titleFilter(data),
        },
        include: {
          financialAccount: { select: { id: true, name: true } },
          title: {
            select: {
              id: true,
              type: true,
              description: true,
              category: { select: { id: true, name: true, nature: true } },
            },
          },
        },
        orderBy: { effectiveDate: "asc" },
      }),
      tx.settlementRefund.findMany({
        where: {
          companyId, reversedAt: null, OR: settlementRanges,
          ...(data.financialAccountId ? { financialAccountId: data.financialAccountId } : {}),
          settlement: { title: titleFilter(data) },
        },
        include: { settlement: { include: { title: { select: { id: true, type: true, description: true, category: { select: { id: true, name: true, nature: true } } } } } } },
        orderBy: { effectiveDate: "asc" },
      }),
      tx.title.findMany({
        where: {
          companyId,
          deletedAt: null,
          status: { not: "CANCELLED" },
          ...titleFilter(data),
        },
        include: {
          category: { select: { id: true, name: true, nature: true } },
          party: { select: { id: true, name: true } },
          costCenter: { select: { id: true, name: true } },
          settlements: { where: { reversedAt: null, effectiveDate: { lte: atUtc(today) } } },
        },
        orderBy: { dueDate: "asc" },
      }),
      reconciliationAvailable ? tx.bankStatementLine.findMany({
        where: {
          companyId,
          status: "PENDING",
          ...(data.financialAccountId ? { financialAccountId: data.financialAccountId } : {}),
        },
        select: { id: true, lineDate: true, amountCents: true, financialAccountId: true },
        orderBy: { lineDate: "asc" },
      }) : Promise.resolve([]),
      reconciliationAvailable ? tx.importBatch.count({
        where: {
          companyId,
          status: "FAILED",
          ...(data.financialAccountId ? { financialAccountId: data.financialAccountId } : {}),
        },
      }) : Promise.resolve(0),
    ]);

    const currentSettlements = settlements.filter((row) =>
      rangeContains(row.effectiveDate, data.from, data.to) && asDateOnly(row.effectiveDate) <= today
    );
    const comparisonSettlements = data.comparisonFrom && data.comparisonTo
      ? settlements.filter((row) => rangeContains(row.effectiveDate, data.comparisonFrom!, data.comparisonTo!))
      : [];
    const currentRefunds = refunds.filter((row) => rangeContains(row.effectiveDate, data.from, data.to) && asDateOnly(row.effectiveDate) <= today);
    const comparisonRefunds = data.comparisonFrom && data.comparisonTo
      ? refunds.filter((row) => rangeContains(row.effectiveDate, data.comparisonFrom!, data.comparisonTo!))
      : [];
    const current = summarizeSettlements(currentSettlements, currentRefunds);
    const comparison = data.comparisonFrom && data.comparisonTo
      ? summarizeSettlements(comparisonSettlements, comparisonRefunds)
      : null;

    const openTitles = titles.map(({ settlements: titleSettlements, ...title }) => {
      const settledPrincipalEquivalent = titleSettlements.reduce(
        (sum, settlement) => sum + settlement.principalAmountCents + settlement.discountCents,
        BigInt(0)
      );
      return { ...title, remainingCents: title.originalAmountCents - settledPrincipalEquivalent };
    }).filter((title) => title.remainingCents > BigInt(0));

    const periodOpenTitles = openTitles.filter((title) => rangeContains(title.dueDate, data.from, data.to));
    const comparisonOpenTitles = data.comparisonFrom && data.comparisonTo
      ? openTitles.filter((title) => rangeContains(title.dueDate, data.comparisonFrom!, data.comparisonTo!))
      : [];
    const overdueTitles = openTitles.filter((title) => asDateOnly(title.dueDate) < today);
    const projectionTitles = openTitles.filter((title) => {
      const due = asDateOnly(title.dueDate);
      // Vencidos continuam sendo compromissos/recebíveis em aberto e entram
      // no primeiro dia da projeção, em vez de desaparecerem do caixa futuro.
      return due <= projectionEnd;
    });

    const availableBalanceCents = accounts
      .filter((account) => account.includedInAvailableTotal)
      .reduce((sum, account) => sum + account.openingBalanceCents + (balanceDeltas.get(account.id) ?? BigInt(0)), BigInt(0));
    const projectionDeltaCents = projectionTitles.reduce(
      (sum, title) => sum + (title.type === "RECEIVABLE" ? title.remainingCents : -title.remainingCents),
      BigInt(0)
    );
    const projectedBalanceCents = availableBalanceCents + projectionDeltaCents;

    let runningBalance = availableBalanceCents;
    let firstNegativeDate: string | null = runningBalance < BigInt(0) ? today : null;
    let firstNegativeWithoutOverdueDate: string | null = firstNegativeDate;
    const projectionByDate = new Map<string, bigint>();
    const projectionWithoutOverdueReceivablesByDate = new Map<string, bigint>();
    for (const title of projectionTitles) {
      const due = asDateOnly(title.dueDate);
      const date = due < today ? today : due;
      const delta = title.type === "RECEIVABLE" ? title.remainingCents : -title.remainingCents;
      projectionByDate.set(date, (projectionByDate.get(date) ?? BigInt(0)) + delta);
      if (title.type !== "RECEIVABLE" || due >= today) {
        projectionWithoutOverdueReceivablesByDate.set(
          date,
          (projectionWithoutOverdueReceivablesByDate.get(date) ?? BigInt(0)) + delta
        );
      }
    }
    let balanceWithoutOverdueReceivablesCents = availableBalanceCents;
    const cashProjectionSeries: Array<{
      date: string;
      projectedBalanceCents: bigint;
      withoutOverdueReceivablesCents: bigint;
    }> = [];
    for (let date = today; date <= projectionEnd; date = addDays(date, 1)) {
      runningBalance += projectionByDate.get(date) ?? BigInt(0);
      balanceWithoutOverdueReceivablesCents += projectionWithoutOverdueReceivablesByDate.get(date) ?? BigInt(0);
      cashProjectionSeries.push({ date, projectedBalanceCents: runningBalance, withoutOverdueReceivablesCents: balanceWithoutOverdueReceivablesCents });
      if (!firstNegativeDate && runningBalance < BigInt(0)) firstNegativeDate = date;
      if (!firstNegativeWithoutOverdueDate && balanceWithoutOverdueReceivablesCents < BigInt(0)) firstNegativeWithoutOverdueDate = date;
    }

    const categoryTotals = new Map<string, { categoryId: string; categoryName: string; cents: bigint }>();
    for (const settlement of currentSettlements) {
      const delta = settlementCashDelta(settlement.title.type, settlement);
      const currentCategory = categoryTotals.get(settlement.title.category.id);
      categoryTotals.set(settlement.title.category.id, {
        categoryId: settlement.title.category.id,
        categoryName: settlement.title.category.name,
        cents: (currentCategory?.cents ?? BigInt(0)) + delta,
      });
    }
    for (const refund of currentRefunds) {
      const title = refund.settlement.title;
      const delta = title.type === "RECEIVABLE" ? -refund.amountCents : refund.amountCents;
      const currentCategory = categoryTotals.get(title.category.id);
      categoryTotals.set(title.category.id, { categoryId: title.category.id, categoryName: title.category.name, cents: (currentCategory?.cents ?? BigInt(0)) + delta });
    }
    const categoryRanking = [...categoryTotals.values()].sort((left, right) => {
      const leftAbs = left.cents < BigInt(0) ? -left.cents : left.cents;
      const rightAbs = right.cents < BigInt(0) ? -right.cents : right.cents;
      return rightAbs > leftAbs ? 1 : rightAbs < leftAbs ? -1 : 0;
    });

    const { strategy, buckets } = createFlowBuckets(data.from, data.to);
    for (const settlement of currentSettlements) {
      const bucket = buckets.get(bucketKey(settlement.effectiveDate, strategy));
      if (!bucket) continue;
      const delta = settlementCashDelta(settlement.title.type, settlement);
      if (settlement.title.type === "RECEIVABLE") bucket.realizedReceiptsCents += delta;
      else bucket.realizedPaymentsCents += -delta;
    }
    for (const refund of currentRefunds) {
      const bucket = buckets.get(bucketKey(refund.effectiveDate, strategy));
      if (!bucket) continue;
      if (refund.settlement.title.type === "RECEIVABLE") bucket.realizedReceiptsCents -= refund.amountCents;
      else bucket.realizedPaymentsCents -= refund.amountCents;
    }
    for (const title of periodOpenTitles) {
      const bucket = buckets.get(bucketKey(title.dueDate, strategy));
      if (!bucket) continue;
      if (title.type === "RECEIVABLE") bucket.forecastReceiptsCents += title.remainingCents;
      else bucket.forecastPaymentsCents += title.remainingCents;
    }

    return {
      today,
      projectionEnd,
      availableBalanceCents,
      projectedBalanceCents,
      balanceWithoutOverdueReceivablesCents,
      firstNegativeDate,
      firstNegativeWithoutOverdueDate,
      cashProjectionSeries,
      accounts: accounts.map((account) => ({
        id: account.id,
        name: account.name,
        type: account.type,
        currency: account.currency,
        includedInAvailableTotal: account.includedInAvailableTotal,
        currentBalanceCents: account.openingBalanceCents + (balanceDeltas.get(account.id) ?? BigInt(0)),
      })),
      current,
      comparison,
      currentSettlements: currentSettlements.map((settlement) => ({
        id: settlement.id,
        effectiveDate: settlement.effectiveDate,
        titleId: settlement.title.id,
        titleType: settlement.title.type,
        titleDescription: settlement.title.description,
        categoryName: settlement.title.category.name,
        accountName: settlement.financialAccount.name,
        cashDeltaCents: settlementCashDelta(settlement.title.type, settlement),
      })),
      periodOpenTitles,
      comparisonOpenTitles,
      overdueTitles,
      projectionTitles,
      categoryRanking,
      flowSeries: [...buckets.values()],
      reconciliation: {
        available: reconciliationAvailable,
        pendingCount: pendingLines.length,
        pendingAmountCents: pendingLines.reduce((sum, line) => {
          const amount = line.amountCents < BigInt(0) ? -line.amountCents : line.amountCents;
          return sum + amount;
        }, BigInt(0)),
        oldestPendingDate: pendingLines[0]?.lineDate ?? null,
        failedImportCount: failedImports,
      },
    };
  });
}
