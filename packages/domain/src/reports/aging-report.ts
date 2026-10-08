import { z } from "zod";
import { withCompanyContext } from "@ax-finance/db";
import { assertActiveMembership } from "../companies/assert-membership";
import { getCompanyToday } from "../shared/today";
import { addReportDays, reportDate } from "./report-period";

export const AGING_BUCKETS = ["A_VENCER", "D1_7", "D8_15", "D16_30", "D31_60", "D60_PLUS"] as const;
export type AgingBucket = (typeof AGING_BUCKETS)[number];

export const agingReportInput = z.object({
  type: z.enum(["RECEIVABLE", "PAYABLE"]).optional(),
  asOfDate: reportDate.optional(),
  bucket: z.enum(AGING_BUCKETS).optional(),
});

export type AgingReportInput = z.infer<typeof agingReportInput>;

function toDateOnlyString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Faixas exatas da Seção 30 ("Atrasos: 1–7, 8–15, 16–30, 31–60 e mais de 60
 * dias"). "Vencido" não é status gravado (Seção 6) — é calculado aqui na
 * leitura, comparando vencimento com a data de referência.
 */
function bucketFor(dueDate: Date, asOf: string): AgingBucket {
  const due = toDateOnlyString(dueDate);
  if (due >= asOf) return "A_VENCER";

  const daysLate = Math.floor((Date.parse(asOf) - Date.parse(due)) / 86_400_000);
  if (daysLate <= 7) return "D1_7";
  if (daysLate <= 15) return "D8_15";
  if (daysLate <= 30) return "D16_30";
  if (daysLate <= 60) return "D31_60";
  return "D60_PLUS";
}

export interface AgingEntry {
  titleId: string;
  type: "RECEIVABLE" | "PAYABLE";
  description: string;
  categoryName: string;
  partyName: string | null;
  costCenterName: string | null;
  daysLate: number;
  dueDate: Date;
  remainingCents: bigint;
  bucket: AgingBucket;
}

export async function getOpenTitlesAgingReport(userId: string, companyId: string, input: unknown) {
  const data = agingReportInput.parse(input);
  await assertActiveMembership(userId, companyId);

  const balanceAsOf = await getCompanyToday(userId, companyId);
  const asOf = data.asOfDate ?? balanceAsOf;

  const titles = await withCompanyContext(userId, companyId, (tx) =>
    tx.title.findMany({
      where: {
        companyId,
        deletedAt: null,
        status: { not: "CANCELLED" },
        ...(data.type ? { type: data.type } : {}),
      },
      include: {
        category: true,
        party: { select: { name: true } },
        costCenter: { select: { name: true } },
        settlements: { where: { reversedAt: null, effectiveDate: { lte: new Date(balanceAsOf) } } },
      },
      orderBy: { dueDate: "asc" },
    })
  );

  const entries: AgingEntry[] = titles.map((title) => {
    const settledPrincipalEquivalent = title.settlements.reduce(
      (sum, settlement) => sum + settlement.principalAmountCents + settlement.discountCents,
      BigInt(0)
    );
    return {
      titleId: title.id,
      type: title.type,
      description: title.description,
      categoryName: title.category.name,
      partyName: title.party?.name ?? null,
      costCenterName: title.costCenter?.name ?? null,
      daysLate: Math.max(0, Math.floor((Date.parse(asOf) - title.dueDate.getTime()) / 86_400_000)),
      dueDate: title.dueDate,
      remainingCents: title.originalAmountCents - settledPrincipalEquivalent,
      bucket: bucketFor(title.dueDate, asOf),
    };
  }).filter((entry) => entry.remainingCents > BigInt(0));

  const schedule = [0, 7, 30].map((days) => {
    const through = addReportDays(asOf, days);
    const due = entries.filter((entry) => toDateOnlyString(entry.dueDate) >= asOf && toDateOnlyString(entry.dueDate) <= through);
    const sumType = (type: "RECEIVABLE" | "PAYABLE") => due.filter((e) => e.type === type).reduce((sum, e) => sum + e.remainingCents, BigInt(0));
    return { days, through, receivableCents: sumType("RECEIVABLE"), payableCents: sumType("PAYABLE") };
  });
  const filteredEntries = data.bucket ? entries.filter((entry) => entry.bucket === data.bucket) : entries;

  const totalsByBucket = new Map<AgingBucket, bigint>();
  for (const entry of entries) {
    totalsByBucket.set(entry.bucket, (totalsByBucket.get(entry.bucket) ?? BigInt(0)) + entry.remainingCents);
  }

  return {
    asOfDate: new Date(`${asOf}T00:00:00Z`),
    balanceAsOfDate: new Date(balanceAsOf),
    schedule,
    entries: filteredEntries,
    allEntries: entries,
    selectedTotalCents: filteredEntries.reduce((sum, e) => sum + e.remainingCents, BigInt(0)),
    totalsByBucket: AGING_BUCKETS.map((bucket) => ({
      bucket,
      cents: totalsByBucket.get(bucket) ?? BigInt(0),
    })),
    totalCents: entries.reduce((sum, entry) => sum + entry.remainingCents, BigInt(0)),
  };
}
