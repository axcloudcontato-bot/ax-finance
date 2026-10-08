import { z } from "zod";
import { withCompanyContext } from "@ax-finance/db";
import { assertActiveMembership } from "../companies/assert-membership";
import { computeAccountBalanceDeltas } from "../financial-accounts/account-balances";
import { getCompanyToday } from "../shared/today";
import { addReportDays, reportDate } from "./report-period";

const projectionInput = z.object({
  today: reportDate.optional(),
  days: z.union([z.literal(30), z.literal(60), z.literal(90)]).default(30),
});

/** Projeção de saldos de principal: a fatura representa as compras do cartão uma única vez. */
export async function getCashProjection(userId: string, companyId: string, input: unknown = {}) {
  const data = projectionInput.parse(input);
  await assertActiveMembership(userId, companyId);
  const today = data.today ?? await getCompanyToday(userId, companyId);
  const through = addReportDays(today, data.days - 1);
  return withCompanyContext(userId, companyId, async (tx) => {
    const [accounts, deltas, titles] = await Promise.all([
      tx.financialAccount.findMany({ where: { companyId, status: "ACTIVE", includedInAvailableTotal: true, openingDate: { lte: new Date(today) } } }),
      computeAccountBalanceDeltas(tx, companyId, new Date(today)),
      tx.title.findMany({
        where: { companyId, deletedAt: null, status: { not: "CANCELLED" }, dueDate: { lte: new Date(through) } },
        include: { settlements: { where: { reversedAt: null, effectiveDate: { lte: new Date(today) } } }, creditCardInvoice: { select: { id: true } } },
        orderBy: { dueDate: "asc" },
      }),
    ]);
    const availableBalanceCents = accounts.reduce((total, account) => total + account.openingBalanceCents + (deltas.get(account.id) ?? BigInt(0)), BigInt(0));
    const items = titles.map((title) => ({
      titleId: title.id, type: title.type, description: title.description,
      dueDate: title.dueDate.toISOString().slice(0, 10),
      isCardInvoice: Boolean(title.creditCardInvoice),
      remainingCents: title.originalAmountCents - title.settlements.reduce((sum, s) => sum + s.principalAmountCents + s.discountCents, BigInt(0)),
    })).filter((item) => item.remainingCents > BigInt(0));
    const daily = new Map<string, { receiptsCents: bigint; paymentsCents: bigint; overdueReceiptsCents: bigint }>();
    let overdueReceivableCents = BigInt(0);
    let overduePayableCents = BigInt(0);
    for (const item of items) {
      const date = item.dueDate < today ? today : item.dueDate;
      const bucket = daily.get(date) ?? { receiptsCents: BigInt(0), paymentsCents: BigInt(0), overdueReceiptsCents: BigInt(0) };
      if (item.type === "RECEIVABLE") {
        bucket.receiptsCents += item.remainingCents;
        if (item.dueDate < today) { bucket.overdueReceiptsCents += item.remainingCents; overdueReceivableCents += item.remainingCents; }
      } else {
        bucket.paymentsCents += item.remainingCents;
        if (item.dueDate < today) overduePayableCents += item.remainingCents;
      }
      daily.set(date, bucket);
    }
    let planned = availableBalanceCents;
    let cautious = availableBalanceCents;
    let minimumCents = cautious;
    let firstNegativeDate: string | null = cautious < BigInt(0) ? today : null;
    let receiptsCents = BigInt(0);
    let paymentsCents = BigInt(0);
    const series = [];
    for (let date = today; date <= through; date = addReportDays(date, 1)) {
      const bucket = daily.get(date) ?? { receiptsCents: BigInt(0), paymentsCents: BigInt(0), overdueReceiptsCents: BigInt(0) };
      receiptsCents += bucket.receiptsCents;
      paymentsCents += bucket.paymentsCents;
      planned += bucket.receiptsCents - bucket.paymentsCents;
      cautious += bucket.receiptsCents - bucket.overdueReceiptsCents - bucket.paymentsCents;
      if (cautious < minimumCents) minimumCents = cautious;
      if (!firstNegativeDate && cautious < BigInt(0)) firstNegativeDate = date;
      series.push({ date, ...bucket, plannedBalanceCents: planned, cautiousBalanceCents: cautious });
    }
    return { today, through, days: data.days, availableBalanceCents, receiptsCents, paymentsCents, overdueReceivableCents, overduePayableCents,
      projectedBalanceCents: planned, cautiousBalanceCents: cautious, minimumCents, firstNegativeDate,
      cashNeededCents: minimumCents < BigInt(0) ? -minimumCents : BigInt(0), items, series,
    };
  });
}
