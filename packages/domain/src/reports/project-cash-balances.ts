import { addReportDays } from "./report-period";

const ZERO = BigInt(0);
type ProjectionItem = { type: "RECEIVABLE" | "PAYABLE"; dueDate: string; remainingCents: bigint };

/** Motor único do painel, calendário e fluxo: vencidos entram hoje; cenário cauteloso retira recebíveis vencidos. */
export function projectCashBalances(today: string, through: string, availableBalanceCents: bigint, items: ProjectionItem[]) {
  const daily = new Map<string, { receiptsCents: bigint; paymentsCents: bigint; overdueReceiptsCents: bigint }>();
  let overdueReceivableCents = ZERO;
  let overduePayableCents = ZERO;
  for (const item of items) {
    if (item.dueDate > through || item.remainingCents <= ZERO) continue;
    const date = item.dueDate < today ? today : item.dueDate;
    const bucket = daily.get(date) ?? { receiptsCents: ZERO, paymentsCents: ZERO, overdueReceiptsCents: ZERO };
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
  let firstNegativeDate: string | null = cautious < ZERO ? today : null;
  let firstNegativePlannedDate: string | null = planned < ZERO ? today : null;
  let receiptsCents = ZERO;
  let paymentsCents = ZERO;
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
    series.push({ date, ...bucket, plannedBalanceCents: planned, cautiousBalanceCents: cautious });
  }
  return { receiptsCents, paymentsCents, overdueReceivableCents, overduePayableCents,
    projectedBalanceCents: planned, cautiousBalanceCents: cautious, minimumCents, firstNegativeDate, firstNegativePlannedDate,
    cashNeededCents: minimumCents < ZERO ? -minimumCents : ZERO, series };
}
