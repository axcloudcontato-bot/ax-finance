import { z } from "zod";
import { withCompanyContext } from "@ax-finance/db";
import { assertActiveMembership } from "../companies/assert-membership";

export const AGING_BUCKETS = ["A_VENCER", "D1_7", "D8_15", "D16_30", "D31_60", "D60_PLUS"] as const;
export type AgingBucket = (typeof AGING_BUCKETS)[number];

export const agingReportInput = z.object({
  type: z.enum(["RECEIVABLE", "PAYABLE"]).optional(),
  asOfDate: z.coerce.date().optional(),
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
  dueDate: Date;
  remainingCents: bigint;
  bucket: AgingBucket;
}

export async function getOpenTitlesAgingReport(userId: string, companyId: string, input: unknown) {
  const data = agingReportInput.parse(input);
  await assertActiveMembership(userId, companyId);

  const asOf = toDateOnlyString(data.asOfDate ?? new Date());

  const titles = await withCompanyContext(userId, companyId, (tx) =>
    tx.title.findMany({
      where: {
        companyId,
        deletedAt: null,
        status: { in: ["OPEN", "PARTIALLY_SETTLED"] },
        ...(data.type ? { type: data.type } : {}),
      },
      include: {
        category: true,
        settlements: { where: { reversedAt: null } },
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
      dueDate: title.dueDate,
      remainingCents: title.originalAmountCents - settledPrincipalEquivalent,
      bucket: bucketFor(title.dueDate, asOf),
    };
  });

  const totalsByBucket = new Map<AgingBucket, bigint>();
  for (const entry of entries) {
    totalsByBucket.set(entry.bucket, (totalsByBucket.get(entry.bucket) ?? BigInt(0)) + entry.remainingCents);
  }

  return {
    asOfDate: data.asOfDate ?? new Date(),
    entries,
    totalsByBucket: AGING_BUCKETS.map((bucket) => ({
      bucket,
      cents: totalsByBucket.get(bucket) ?? BigInt(0),
    })),
    totalCents: entries.reduce((sum, entry) => sum + entry.remainingCents, BigInt(0)),
  };
}
