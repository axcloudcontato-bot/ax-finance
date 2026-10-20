import { withCompanyContext, withCompanyReadSnapshot, type TenantScopedClient } from "@ax-finance/db";
import { assertActiveMembership } from "../companies/assert-membership";
import { assertCompanyPermission } from "../companies/permissions";
import { CompanyAccessScopeInvalidError } from "../errors";
import { lockPeriodClosure } from "../closures/assert-period-open";
import { companyToday } from "../shared/today";
import { getLiveMonthlyReportData, renderMonthlyReportPdf, type MonthlyReportData } from "./monthly-report";
import { getOpenTitlesAgingReport, type AgingEntry } from "./aging-report";
import { z } from "zod";
import { getProfitabilityReportInTx } from "./profitability-report";
import { recordAuditEvent } from "../audit/record-audit-event";
import { getManagerialIncomeStatementInTx } from "./managerial-income-statement";

const CALCULATION_VERSION = "finance-2026-10-v1";
const periodInput = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
type SnapshotPayload = { monthly: MonthlyReportData; aging: AgingEntry[]; pdfBase64: string; ledger?: unknown; profitability?: Record<"NONE" | "REVENUE", Awaited<ReturnType<typeof getProfitabilityReportInTx>>>; incomeStatement?: { from: string; to: string; report: Awaited<ReturnType<typeof getManagerialIncomeStatementInTx>> } };

export async function assertFullReportAccess(userId: string, companyId: string) {
  const membership = await assertActiveMembership(userId, companyId);
  if (membership.role !== "OWNER" && membership.accessScope === "RESTRICTED") throw new CompanyAccessScopeInvalidError();
}

// Centavos não passam por Number; a cópia mantém todos os valores exatos.
function encode(value: unknown) {
  return JSON.parse(JSON.stringify(value, (_key, v) => typeof v === "bigint" ? { __axCents: v.toString() } : v));
}
function decode(value: unknown): SnapshotPayload {
  const data = JSON.parse(JSON.stringify(value), (_key, v) => v && typeof v === "object" && typeof v.__axCents === "string" ? BigInt(v.__axCents) : v) as SnapshotPayload;
  if (!data.monthly || !Array.isArray(data.aging) || !data.pdfBase64) throw new Error("Versão de relatório inválida.");
  data.aging = data.aging.map((entry) => ({ ...entry, dueDate: new Date(entry.dueDate) }));
  return data;
}

/** Posição no DIA da captura. Sem versões anteriores, não reconstrói cancelamentos ou estornos antigos. */
export async function captureReportSnapshotInTx(tx: TenantScopedClient, userId: string, companyId: string, period: string, kind: "CLOSING" | "PDF", sourceKey?: string) {
  const from = `${period}-01`;
  const [year, month] = period.split("-").map(Number);
  const to = new Date(Date.UTC(year!, month!, 0)).toISOString().slice(0, 10);
  const version = (await tx.reportSnapshot.aggregate({ where: { companyId, period, kind }, _max: { version: true } }))._max.version ?? 0;
  // A trava de fechamento já foi adquirida pelo chamador. A fotografia começa
  // depois dela e inclui também os serviços que abrem contextos internamente.
  const [monthly, aging, ledger, asOf, profitabilityNone, profitabilityRevenue, incomeStatement] = await withCompanyReadSnapshot(userId, companyId, (tx) => Promise.all([
    getLiveMonthlyReportData(userId, companyId, period),
    getOpenTitlesAgingReport(userId, companyId, {}),
    (async () => ({
      titles: await tx.title.findMany({ where: { companyId, OR: [
        { competenceDate: { gte: new Date(from), lte: new Date(to) } },
        { settlements: { some: { effectiveDate: { gte: new Date(from), lte: new Date(to) } } } },
        { deletedAt: null, status: { in: ["OPEN", "PARTIALLY_SETTLED"] } },
        { deletedAt: null, settlements: { some: { reversedAt: null, effectiveDate: { gt: new Date(await companyToday(tx, companyId)) } } } },
      ] }, include: { category: true, costCenter: true, allocations: { include: { category: true, costCenter: true } }, settlements: true } }),
      purchases: await tx.creditCardPurchase.findMany({ where: { companyId, competenceDate: { gte: new Date(from), lte: new Date(to) } }, include: { category: true, costCenter: true } }),
      debts: await tx.debt.findMany({ where: { companyId } }),
    }))(),
    companyToday(tx, companyId),
    getProfitabilityReportInTx(tx, companyId, { from, to, fixedAllocation: "NONE" }),
    getProfitabilityReportInTx(tx, companyId, { from, to, fixedAllocation: "REVENUE" }),
    getManagerialIncomeStatementInTx(tx, companyId, { from, to }),
  ]));
  monthly.snapshot = { kind, version: version + 1, asOfDate: asOf, calculationVersion: CALCULATION_VERSION };
  const pdf = await renderMonthlyReportPdf(monthly);
  const snapshot = await tx.reportSnapshot.create({ data: { companyId, period, kind, version: version + 1, asOfDate: new Date(asOf), createdByUserId: userId, calculationVersion: CALCULATION_VERSION, sourceKey,
    payload: encode({ monthly, aging: aging.allEntries, ledger, profitability: { NONE: profitabilityNone, REVENUE: profitabilityRevenue }, incomeStatement: { from, to, report: incomeStatement }, pdfBase64: pdf.toString("base64") }) } });
  await recordAuditEvent(tx, { companyId, actorUserId: userId, eventType: "REPORT_VERSION_PRESERVED", resourceType: "ReportSnapshot", resourceId: snapshot.id, summary: `${period} · ${kind === "CLOSING" ? "Fechamento" : "PDF"} · versão ${snapshot.version}`, metadata: { period, kind, version: snapshot.version, asOfDate: asOf, calculationVersion: CALCULATION_VERSION } });
  return snapshot;
}

export async function listReportSnapshots(userId: string, companyId: string, period?: string) {
  const membership = await assertActiveMembership(userId, companyId);
  if (membership.role !== "OWNER" && membership.accessScope === "RESTRICTED") return [];
  if (period) periodInput.parse(period);
  return withCompanyContext(userId, companyId, (tx) => tx.reportSnapshot.findMany({ where: { companyId, ...(period ? { period } : {}) }, select: { id: true, period: true, kind: true, version: true, asOfDate: true, createdAt: true, calculationVersion: true }, orderBy: [{ period: "desc" }, { createdAt: "desc" }] }));
}

export async function getReportSnapshot(userId: string, companyId: string, snapshotId: string) {
  await assertFullReportAccess(userId, companyId);
  const row = await withCompanyContext(userId, companyId, (tx) => tx.reportSnapshot.findFirst({ where: { id: snapshotId, companyId } }));
  if (!row) throw new Error("Versão de relatório não encontrada nesta empresa.");
  return { ...row, data: decode(row.payload) };
}

export async function getClosedMonthlySnapshot(userId: string, companyId: string, period: string) {
  await assertFullReportAccess(userId, companyId);
  return withCompanyContext(userId, companyId, async (tx) => {
    const closure = await tx.periodClosure.findUnique({ where: { companyId_period: { companyId, period } } });
    if (closure?.status !== "CLOSED") return null;
    const row = await tx.reportSnapshot.findFirst({ where: { companyId, period, kind: "CLOSING" }, orderBy: { version: "desc" } });
    return row ? { id: row.id, ...decode(row.payload) } : null;
  });
}

/** Cada PDF emitido fica recuperável byte a byte. Repetição de um envio usa a mesma versão. */
export async function prepareMonthlyReportPdf(userId: string, companyId: string, rawPeriod: string, options: { snapshotId?: string; sourceKey?: string } = {}) {
  const period = periodInput.parse(rawPeriod);
  await assertCompanyPermission(userId, companyId, "EXPORT");
  await assertFullReportAccess(userId, companyId);
  if (options.snapshotId) {
    const row = await getReportSnapshot(userId, companyId, options.snapshotId);
    if (row.period !== period) throw new Error("A versão selecionada pertence a outro mês.");
    return { snapshotId: row.id, data: row.data.monthly, pdf: Buffer.from(row.data.pdfBase64, "base64") };
  }
  return withCompanyContext(userId, companyId, async (tx) => {
    await lockPeriodClosure(tx, companyId);
    const existing = options.sourceKey ? await tx.reportSnapshot.findFirst({ where: { companyId, sourceKey: options.sourceKey } }) : null;
    const closed = await tx.periodClosure.findUnique({ where: { companyId_period: { companyId, period } } });
    const closing = closed?.status === "CLOSED" ? await tx.reportSnapshot.findFirst({ where: { companyId, period, kind: "CLOSING" }, orderBy: { version: "desc" } }) : null;
    let row = existing ?? closing;
    if (!existing && closing && options.sourceKey) {
      const version = ((await tx.reportSnapshot.aggregate({ where: { companyId, period, kind: "PDF" }, _max: { version: true } }))._max.version ?? 0) + 1;
      row = await tx.reportSnapshot.create({ data: { companyId, period, kind: "PDF", version, asOfDate: closing.asOfDate, createdByUserId: userId, calculationVersion: closing.calculationVersion, sourceKey: options.sourceKey, payload: closing.payload! } });
      await recordAuditEvent(tx, { companyId, actorUserId: userId, eventType: "REPORT_VERSION_PRESERVED", resourceType: "ReportSnapshot", resourceId: row.id, summary: `PDF preservado a partir do fechamento ${period}`, metadata: { originSnapshotId: closing.id, version } });
    }
    row ??= await captureReportSnapshotInTx(tx, userId, companyId, period, "PDF", options.sourceKey);
    const data = decode(row.payload);
    return { snapshotId: row.id, data: data.monthly, pdf: Buffer.from(data.pdfBase64, "base64") };
  }, undefined, { timeout: 75_000, maxWait: 10_000 });
}
