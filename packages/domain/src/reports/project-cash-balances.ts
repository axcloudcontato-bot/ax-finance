import { addReportDays } from "./report-period";

const ZERO = BigInt(0);
export type ProjectionItem = { type: "RECEIVABLE" | "PAYABLE"; dueDate: string; remainingCents: bigint; contractualCents?: bigint; excludeFromContractual?: boolean; projectionDate?: string; receiptProbabilityBps?: number; isEstimate?: boolean; isCardInvoice?: boolean; titleId?: string; description?: string };

/** Motor único do painel, calendário e fluxo: vencidos entram hoje; cenário cauteloso retira recebíveis vencidos. */
export function projectCashBalances(today: string, through: string, availableBalanceCents: bigint, items: ProjectionItem[], options: { minimumReserveCents?: bigint; receiptDelayDays?: number; includeEstimates?: boolean } = {}) {
  const reserveCents = options.minimumReserveCents ?? ZERO;
  const expectedDaily = new Map<string, { expectedReceiptsCents: bigint; expectedPaymentsCents: bigint; stressedReceiptsCents: bigint }>();
  const addExpected = (date: string, field: "expectedReceiptsCents" | "expectedPaymentsCents" | "stressedReceiptsCents", cents: bigint) => {
    if (date > through) return;
    const day = date < today ? today : date;
    const row = expectedDaily.get(day) ?? { expectedReceiptsCents: ZERO, expectedPaymentsCents: ZERO, stressedReceiptsCents: ZERO };
    row[field] += cents; expectedDaily.set(day, row);
  };
  for (const item of items) {
    if (item.remainingCents <= ZERO || (item.isEstimate && !options.includeEstimates)) continue;
    const date = item.projectionDate ?? item.dueDate;
    if (item.type === "PAYABLE") addExpected(date, "expectedPaymentsCents", item.remainingCents);
    else {
      const cents = item.remainingCents * BigInt(item.receiptProbabilityBps ?? 10000) / BigInt(10000);
      addExpected(date, "expectedReceiptsCents", cents);
      addExpected(addReportDays(date < today ? today : date, options.receiptDelayDays ?? 0), "stressedReceiptsCents", cents);
    }
  }
  const daily = new Map<string, { receiptsCents: bigint; paymentsCents: bigint; overdueReceiptsCents: bigint }>();
  let overdueReceivableCents = ZERO;
  let overduePayableCents = ZERO;
  for (const item of items) {
    const cents = item.contractualCents ?? item.remainingCents;
    if (item.isEstimate || item.excludeFromContractual || item.dueDate > through || cents <= ZERO) continue;
    const date = item.dueDate < today ? today : item.dueDate;
    const bucket = daily.get(date) ?? { receiptsCents: ZERO, paymentsCents: ZERO, overdueReceiptsCents: ZERO };
    if (item.type === "RECEIVABLE") {
      bucket.receiptsCents += cents;
      if (item.dueDate < today) { bucket.overdueReceiptsCents += cents; overdueReceivableCents += cents; }
    } else {
      bucket.paymentsCents += cents;
      if (item.dueDate < today) overduePayableCents += cents;
    }
    daily.set(date, bucket);
  }
  let planned = availableBalanceCents;
  let cautious = availableBalanceCents;
  let minimumCents = cautious;
  let firstNegativeDate: string | null = cautious < ZERO ? today : null;
  let firstNegativePlannedDate: string | null = planned < ZERO ? today : null;
  let receiptsCents = ZERO;
  let paymentsCents = ZERO;
  let expected = availableBalanceCents;
  let stressed = availableBalanceCents;
  let minimumExpectedCents = expected;
  let minimumStressedCents = stressed;
  let firstBelowReserveDate: string | null = expected < reserveCents ? today : null;
  let firstBelowReserveStressDate: string | null = stressed < reserveCents ? today : null;
  const series = [];
  for (let date = today; date <= through; date = addReportDays(date, 1)) {
    const bucket = daily.get(date) ?? { receiptsCents: ZERO, paymentsCents: ZERO, overdueReceiptsCents: ZERO };
    receiptsCents += bucket.receiptsCents;
    paymentsCents += bucket.paymentsCents;
    planned += bucket.receiptsCents - bucket.paymentsCents;
    cautious += bucket.receiptsCents - bucket.overdueReceiptsCents - bucket.paymentsCents;
    if (cautious < minimumCents) minimumCents = cautious;
    if (!firstNegativeDate && cautious < ZERO) firstNegativeDate = date;
    if (!firstNegativePlannedDate && planned < ZERO) firstNegativePlannedDate = date;
    const expectedBucket = expectedDaily.get(date) ?? { expectedReceiptsCents: ZERO, expectedPaymentsCents: ZERO, stressedReceiptsCents: ZERO };
    expected += expectedBucket.expectedReceiptsCents - expectedBucket.expectedPaymentsCents;
    stressed += expectedBucket.stressedReceiptsCents - expectedBucket.expectedPaymentsCents;
    if (expected < minimumExpectedCents) minimumExpectedCents = expected;
    if (stressed < minimumStressedCents) minimumStressedCents = stressed;
    if (!firstBelowReserveDate && expected < reserveCents) firstBelowReserveDate = date;
    if (!firstBelowReserveStressDate && stressed < reserveCents) firstBelowReserveStressDate = date;
    series.push({ date, ...bucket, ...expectedBucket, plannedBalanceCents: planned, cautiousBalanceCents: cautious, expectedBalanceCents: expected, stressedBalanceCents: stressed });
  }
  return { receiptsCents, paymentsCents, overdueReceivableCents, overduePayableCents,
    projectedBalanceCents: planned, cautiousBalanceCents: cautious, minimumCents, firstNegativeDate, firstNegativePlannedDate,
    cashNeededCents: minimumCents < ZERO ? -minimumCents : ZERO, series,
    minimumReserveCents: reserveCents, expectedBalanceCents: expected, stressedBalanceCents: stressed, minimumExpectedCents, minimumStressedCents,
    firstBelowReserveDate, firstBelowReserveStressDate,
    reserveNeededCents: minimumStressedCents < reserveCents ? reserveCents - minimumStressedCents : ZERO,
    deficitContributors: firstBelowReserveStressDate ? items.filter((item) => item.type === "PAYABLE" && item.remainingCents > ZERO && (!item.isEstimate || options.includeEstimates) && ((item.projectionDate ?? item.dueDate) < today ? today : item.projectionDate ?? item.dueDate) === firstBelowReserveStressDate).sort((a, b) => a.remainingCents > b.remainingCents ? -1 : a.remainingCents < b.remainingCents ? 1 : (a.titleId ?? "").localeCompare(b.titleId ?? "")) : [],
  };
}
