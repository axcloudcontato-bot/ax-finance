import { withCompanyContext, type TenantScopedClient } from "@ax-finance/db";
import { z } from "zod";
import { assertFullReportAccess, getReportSnapshot } from "./report-snapshots";
import { assertCompanyPlanFeature } from "../subscriptions/plan-features";
import { loadDebtSchedules } from "../wealth/debt-installments";
import { reportPeriod } from "./report-period";

const ZERO = BigInt(0);
export type ProfitabilityLine = { categoryId: string; categoryName: string; nature: string; costBehavior: string; costCenterId: string | null; costCenterName: string | null; signedCents: bigint };
export const profitabilityInput = reportPeriod.and(z.object({ fixedAllocation: z.enum(["NONE", "REVENUE"]).default("NONE"), snapshotId: z.string().uuid().optional() }));

/** Rateio gerencial opcional; soma exata e desempate determinístico dos centavos. Não altera o razão. */
export function allocateByRevenue(cents: bigint, weights: { id: string; revenueCents: bigint }[]) {
  const total = weights.reduce((sum, row) => sum + (row.revenueCents > ZERO ? row.revenueCents : ZERO), ZERO);
  if (cents <= ZERO || total <= ZERO) return new Map<string, bigint>();
  const shares = weights.filter((row) => row.revenueCents > ZERO).map((row) => ({ id: row.id, cents: cents * row.revenueCents / total, remainder: cents * row.revenueCents % total }));
  let remaining = cents - shares.reduce((sum, row) => sum + row.cents, ZERO);
  shares.sort((a, b) => a.remainder > b.remainder ? -1 : a.remainder < b.remainder ? 1 : a.id.localeCompare(b.id));
  for (const row of shares) { if (remaining <= ZERO) break; row.cents += BigInt(1); remaining -= BigInt(1); }
  return new Map(shares.map((row) => [row.id, row.cents]));
}

export function computeProfitability(lines: ProfitabilityLine[], fixedAllocation: "NONE" | "REVENUE" = "NONE") {
  const map = new Map<string, { id: string; name: string; revenueCents: bigint; variableCents: bigint; fixedCents: bigint; unclassifiedCents: bigint; unclassifiedCount: number; allocatedFixedCents: bigint }>();
  const unknown = new Map<string, string>();
  for (const line of lines) {
    if (!["OPERATING_REVENUE", "COST", "EXPENSE"].includes(line.nature)) continue;
    const id = line.costCenterId ?? "UNASSIGNED";
    const row = map.get(id) ?? { id, name: line.costCenterName ?? "Sem centro / projeto", revenueCents: ZERO, variableCents: ZERO, fixedCents: ZERO, unclassifiedCents: ZERO, unclassifiedCount: 0, allocatedFixedCents: ZERO };
    if (line.nature === "OPERATING_REVENUE") row.revenueCents += line.signedCents;
    else if (line.costBehavior === "VARIABLE") row.variableCents -= line.signedCents;
    else if (line.costBehavior === "FIXED") row.fixedCents -= line.signedCents;
    else { row.unclassifiedCents -= line.signedCents; row.unclassifiedCount++; unknown.set(line.categoryId, line.categoryName); }
    map.set(id, row);
  }
  const rows = [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  const unassigned = map.get("UNASSIGNED");
  const sharedFixedCents = unassigned?.fixedCents ?? ZERO;
  const shares = fixedAllocation === "REVENUE" ? allocateByRevenue(sharedFixedCents, rows.filter((row) => row.id !== "UNASSIGNED")) : new Map<string, bigint>();
  let allocated = ZERO;
  for (const row of rows) { row.allocatedFixedCents = shares.get(row.id) ?? ZERO; allocated += row.allocatedFixedCents; }
  const finalize = (row: typeof rows[number], complete: boolean) => {
    const contributionCents = complete ? row.revenueCents - row.variableCents : null;
    const fixedCents = row.fixedCents + row.allocatedFixedCents;
    const breakEvenCents = contributionCents !== null && contributionCents > ZERO && row.revenueCents > ZERO && row.variableCents >= ZERO && fixedCents >= ZERO
      ? (fixedCents * row.revenueCents + contributionCents - BigInt(1)) / contributionCents : null;
    return { ...row, contributionCents, contributionBps: contributionCents !== null && row.revenueCents > ZERO ? Number(contributionCents * BigInt(10000) / row.revenueCents) : null,
      resultCents: row.revenueCents - row.variableCents - fixedCents - row.unclassifiedCents,
      breakEvenCents, safetyMarginCents: breakEvenCents === null ? null : row.revenueCents - breakEvenCents };
  };
  const total = rows.reduce((sum, row) => ({ ...sum, revenueCents: sum.revenueCents + row.revenueCents, variableCents: sum.variableCents + row.variableCents, fixedCents: sum.fixedCents + row.fixedCents, unclassifiedCents: sum.unclassifiedCents + row.unclassifiedCents, unclassifiedCount: sum.unclassifiedCount + row.unclassifiedCount }),
    { id: "TOTAL", name: "Total da empresa", revenueCents: ZERO, variableCents: ZERO, fixedCents: ZERO, unclassifiedCents: ZERO, unclassifiedCount: 0, allocatedFixedCents: ZERO });
  // Retira do saldo sem centro apenas o que foi realmente distribuído, sem duplicar despesa.
  if (unassigned) unassigned.fixedCents -= allocated;
  const hasUnassignedVariable = Boolean(unassigned && (unassigned.variableCents !== ZERO || unassigned.unclassifiedCount > 0));
  return { rows: rows.map((row) => finalize(row, row.unclassifiedCount === 0 && (row.id === "UNASSIGNED" || !hasUnassignedVariable))),
    totals: finalize(total, total.unclassifiedCount === 0), unclassifiedCategories: [...unknown].map(([id, name]) => ({ id, name })),
    fixedAllocation, allocatedFixedCents: allocated, sharedFixedCents, hasUnassignedVariable };
}

export async function getProfitabilityReportInTx(tx: TenantScopedClient, companyId: string, input: z.infer<typeof profitabilityInput>) {
  const range = { gte: new Date(input.from), lte: new Date(input.to) };
  const [titles, purchases] = await Promise.all([
    tx.title.findMany({ where: { companyId, deletedAt: null, status: { not: "CANCELLED" }, competenceDate: range, creditCardInvoice: null }, include: { category: true, costCenter: true, allocations: { include: { category: true, costCenter: true } } } }),
    tx.creditCardPurchase.findMany({ where: { companyId, canceledAt: null, competenceDate: range }, include: { category: true, costCenter: true } }),
  ]);
  const debts = await loadDebtSchedules(tx, companyId, titles.map((title) => title.installmentGroupId));
  const lines: ProfitabilityLine[] = [];
  for (const title of titles) {
    if (title.installmentGroupId && title.installmentNumber && debts.get(title.installmentGroupId)?.has(title.installmentNumber)) continue;
    const allocations = title.allocations.length ? title.allocations : [{ category: title.category, costCenter: title.costCenter, amountCents: title.originalAmountCents }];
    for (const line of allocations) lines.push({ categoryId: line.category.id, categoryName: line.category.name, nature: line.category.nature, costBehavior: line.category.costBehavior,
      costCenterId: line.costCenter?.id ?? null, costCenterName: line.costCenter?.name ?? null, signedCents: title.type === "RECEIVABLE" ? line.amountCents : -line.amountCents });
  }
  for (const purchase of purchases) lines.push({ categoryId: purchase.category.id, categoryName: purchase.category.name, nature: purchase.category.nature, costBehavior: purchase.category.costBehavior,
    costCenterId: purchase.costCenterId, costCenterName: purchase.costCenter?.name ?? null, signedCents: -purchase.amountCents });
  return { from: input.from, to: input.to, ...computeProfitability(lines, input.fixedAllocation) };
}

export async function getProfitabilityReport(userId: string, companyId: string, input: unknown) {
  const data = profitabilityInput.parse(input);
  await assertFullReportAccess(userId, companyId);
  await assertCompanyPlanFeature(userId, companyId, "MANAGERIAL_DRE");
  if (data.snapshotId) {
    const snapshot = await getReportSnapshot(userId, companyId, data.snapshotId);
    const saved = snapshot.data.profitability?.[data.fixedAllocation];
    if (!saved || saved.from !== data.from || saved.to !== data.to) throw new Error("Escolha o mês completo correspondente à versão preservada.");
    return { ...saved, capturedAsOf: snapshot.asOfDate.toISOString().slice(0, 10) };
  }
  return { ...await withCompanyContext(userId, companyId, (tx) => getProfitabilityReportInTx(tx, companyId, data)), capturedAsOf: null };
}
