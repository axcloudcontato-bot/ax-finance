import PDFDocument from "pdfkit";
import { z } from "zod";
import { withCompanyContext } from "@ax-finance/db";
import { assertActiveMembership } from "../companies/assert-membership";
import { CompanyAccessScopeInvalidError } from "../errors";
import { settlementCashDelta } from "../titles/settlement-cash-delta";
import { getDashboardInsights, type CategoryShare } from "./dashboard-insights";
import { getDashboardOverview } from "./dashboard-overview";
import { getBudgetReport } from "../budgets/budgets";
import { listSavingsGoals } from "../savings-goals/savings-goals";
import { enqueueMonthlyReportEmail } from "../outbox/events";

const monthInput = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const ZERO = BigInt(0);

function monthBounds(month: string) {
  const [year, monthNumber] = month.split("-").map(Number) as [number, number];
  const last = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

function previousMonth(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number) as [number, number];
  const date = new Date(Date.UTC(year, monthNumber - 2, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthReportLabel(month: string): string {
  const label = new Date(`${month}-01T00:00:00Z`).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export interface MonthlyReportData {
  companyName: string;
  month: string;
  monthLabel: string;
  generatedOn: string;
  result: { revenueCents: bigint; expenseCents: bigint; resultCents: bigint; marginBps: number | null };
  previousResult: { revenueCents: bigint; expenseCents: bigint; resultCents: bigint } | null;
  cash: { receivedCents: bigint; paidCents: bigint };
  topExpenses: CategoryShare[];
  delinquency: { openReceivableCents: bigint; overdueReceivableCents: bigint; delinquencyBps: number };
  projection: { availableCents: bigint; projectedCents: bigint; days: number; firstNegativeDate: string | null };
  budget: { plannedCents: bigint; actualCents: bigint; overCount: number } | null;
  savings: { savedCents: bigint; targetCents: bigint; activeCount: number } | null;
}

/**
 * Números do relatório mensal, todos tirados das mesmas fontes das telas (painel, orçamento,
 * cofrinhos): resultado por competência, caixa pelas baixas, inadimplência e projeção de 30 dias
 * na data em que o relatório é gerado.
 */
export async function getMonthlyReportData(userId: string, companyId: string, rawMonth: string): Promise<MonthlyReportData> {
  const month = monthInput.parse(rawMonth);
  await assertActiveMembership(userId, companyId);
  const { from, to } = monthBounds(month);
  const previous = monthBounds(previousMonth(month));

  const [base, insights, overview, budget, savings] = await Promise.all([
    withCompanyContext(userId, companyId, async (tx) => {
      const company = await tx.company.findUniqueOrThrow({ where: { id: companyId }, select: { name: true, timezone: true } });
      const settlements = await tx.settlement.findMany({
        where: { companyId, reversedAt: null, effectiveDate: { gte: new Date(`${from}T00:00:00Z`), lte: new Date(`${to}T00:00:00Z`) } },
        select: { principalAmountCents: true, interestPenaltyCents: true, feesCents: true, title: { select: { type: true } } },
      });
      let receivedCents = ZERO;
      let paidCents = ZERO;
      for (const settlement of settlements) {
        const delta = settlementCashDelta(settlement.title.type, settlement);
        if (delta >= ZERO) receivedCents += delta;
        else paidCents += -delta;
      }
      return { company, receivedCents, paidCents };
    }),
    getDashboardInsights(userId, companyId, { from, to, comparisonFrom: previous.from, comparisonTo: previous.to }),
    getDashboardOverview(userId, companyId, { from, to, projectionDays: 30 }),
    getBudgetReport(userId, companyId, month),
    listSavingsGoals(userId, companyId),
  ]);

  return {
    companyName: base.company.name,
    month,
    monthLabel: monthReportLabel(month),
    generatedOn: insights.today,
    result: insights.period,
    previousResult: insights.comparison,
    cash: { receivedCents: base.receivedCents, paidCents: base.paidCents },
    topExpenses: insights.expenseByCategory.slice(0, 6),
    delinquency: {
      openReceivableCents: insights.health.openReceivableCents,
      overdueReceivableCents: insights.health.overdueReceivableCents,
      delinquencyBps: insights.health.delinquencyBps,
    },
    projection: {
      availableCents: overview.availableBalanceCents,
      projectedCents: overview.projectedBalanceCents,
      days: 30,
      firstNegativeDate: overview.firstNegativeDate,
    },
    budget: budget.totals.plannedCents > ZERO
      ? { plannedCents: budget.totals.plannedCents, actualCents: budget.totals.actualOnBudgetedCents, overCount: budget.totals.overCount }
      : null,
    savings: savings.totals.activeCount > 0
      ? { savedCents: savings.totals.savedCents, targetCents: savings.totals.targetCents, activeCount: savings.totals.activeCount }
      : null,
  };
}

// ---------- PDF ----------

const COLORS = { ink: "#1a1d23", muted: "#5b6270", line: "#d9dce1", soft: "#f3f5f9", accent: "#3675ec", positive: "#0c8465", negative: "#c23d68" };

const money = (cents: bigint) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(cents) / 100).replace(/ /g, " ");
const percent = (bpsValue: number) => `${(bpsValue / 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
const dateBr = (value: string) => value.split("-").reverse().join("/");

function variation(current: bigint, before: bigint | undefined): string {
  if (before === undefined) return "";
  if (before === ZERO) return current === ZERO ? "igual ao mês anterior" : "sem base no mês anterior";
  const change = Number(((current - before) * BigInt(1000)) / (before < ZERO ? -before : before)) / 10;
  return `${change > 0 ? "+" : ""}${change.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% vs. mês anterior`;
}

/** PDF A4 do relatório mensal (pdfkit, fontes padrão: acentos do português suportados). */
export function renderMonthlyReportPdf(data: MonthlyReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 48, info: { Title: `Relatório mensal ${data.monthLabel} - ${data.companyName}`, Author: "AX Finance" } });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const left = doc.page.margins.left;
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    // Cabeçalho
    doc.rect(0, 0, doc.page.width, 96).fill(COLORS.accent);
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(20).text("Relatório mensal", left, 30, { width });
    doc.font("Helvetica").fontSize(11).text(`${data.companyName} · ${data.monthLabel}`, left, 58, { width });
    doc.y = 120;

    const section = (title: string) => {
      if (doc.y > doc.page.height - 160) doc.addPage();
      doc.moveDown(0.6);
      doc.fillColor(COLORS.ink).font("Helvetica-Bold").fontSize(13).text(title, left, doc.y, { width });
      doc.moveTo(left, doc.y + 3).lineTo(left + width, doc.y + 3).lineWidth(0.6).strokeColor(COLORS.line).stroke();
      doc.moveDown(0.7);
    };

    const boxes = (items: { label: string; value: string; note?: string; color?: string }[]) => {
      const gap = 10;
      const boxWidth = (width - gap * (items.length - 1)) / items.length;
      const top = doc.y;
      items.forEach((item, index) => {
        const x = left + index * (boxWidth + gap);
        doc.roundedRect(x, top, boxWidth, 64, 6).fill(COLORS.soft);
        doc.fillColor(COLORS.muted).font("Helvetica").fontSize(9).text(item.label, x + 10, top + 9, { width: boxWidth - 20 });
        doc.fillColor(item.color ?? COLORS.ink).font("Helvetica-Bold").fontSize(15).text(item.value, x + 10, top + 23, { width: boxWidth - 20 });
        if (item.note) doc.fillColor(COLORS.muted).font("Helvetica").fontSize(8).text(item.note, x + 10, top + 45, { width: boxWidth - 20 });
      });
      doc.y = top + 64;
      doc.x = left;
    };

    const paragraph = (text: string) => {
      doc.moveDown(0.5);
      doc.fillColor(COLORS.muted).font("Helvetica").fontSize(9.5).text(text, left, doc.y, { width });
    };

    // Resultado
    section("Resultado do mês (por competência)");
    const { result, previousResult } = data;
    boxes([
      { label: "Receitas", value: money(result.revenueCents), note: variation(result.revenueCents, previousResult?.revenueCents) },
      { label: "Despesas", value: money(result.expenseCents), note: variation(result.expenseCents, previousResult?.expenseCents) },
      { label: "Resultado", value: money(result.resultCents), color: result.resultCents < ZERO ? COLORS.negative : COLORS.positive, note: result.marginBps !== null ? `margem de ${percent(result.marginBps)}` : undefined },
    ]);

    // Caixa
    section("Caixa do mês (recebido e pago)");
    boxes([
      { label: "Recebido", value: money(data.cash.receivedCents), color: COLORS.positive },
      { label: "Pago", value: money(data.cash.paidCents), color: COLORS.negative },
      { label: "Geração de caixa", value: money(data.cash.receivedCents - data.cash.paidCents), color: data.cash.receivedCents - data.cash.paidCents < ZERO ? COLORS.negative : COLORS.ink },
    ]);

    // Maiores gastos
    section("Maiores gastos");
    if (data.topExpenses.length === 0) {
      paragraph("Nenhuma despesa lançada neste mês.");
    } else {
      const maxCents = data.topExpenses.reduce((max, item) => (item.cents > max ? item.cents : max), ZERO);
      for (const item of data.topExpenses) {
        const top = doc.y;
        doc.fillColor(COLORS.ink).font("Helvetica").fontSize(10).text(item.name, left, top, { width: width * 0.42, ellipsis: true, lineBreak: false });
        const barX = left + width * 0.44;
        const barWidth = width * 0.32;
        doc.roundedRect(barX, top + 2, barWidth, 8, 4).fill(COLORS.soft);
        const filled = maxCents > ZERO ? Math.max(3, (Number(item.cents) / Number(maxCents)) * barWidth) : 0;
        if (filled) doc.roundedRect(barX, top + 2, filled, 8, 4).fill(COLORS.accent);
        doc.fillColor(COLORS.ink).font("Helvetica-Bold").fontSize(10).text(money(item.cents), left + width * 0.78, top, { width: width * 0.14, align: "right", lineBreak: false });
        doc.fillColor(COLORS.muted).font("Helvetica").fontSize(9).text(percent(item.shareBps), left + width * 0.93, top + 1, { width: width * 0.07, align: "right", lineBreak: false });
        doc.y = top + 18;
        doc.x = left;
      }
    }

    // Inadimplência e projeção
    section("Contas a receber e projeção");
    const projectionNote = data.projection.firstNegativeDate ? `saldo fica negativo em ${dateBr(data.projection.firstNegativeDate)}` : "sem saldo negativo previsto";
    boxes([
      { label: "A receber em aberto", value: money(data.delinquency.openReceivableCents) },
      { label: "Vencido (inadimplência)", value: money(data.delinquency.overdueReceivableCents), color: data.delinquency.overdueReceivableCents > ZERO ? COLORS.negative : COLORS.ink, note: `${percent(data.delinquency.delinquencyBps)} do que há a receber` },
      { label: `Saldo previsto em ${data.projection.days} dias`, value: money(data.projection.projectedCents), color: data.projection.projectedCents < ZERO ? COLORS.negative : COLORS.ink, note: `hoje ${money(data.projection.availableCents)} · ${projectionNote}` },
    ]);

    if (data.budget || data.savings) {
      section("Orçamento e cofrinhos");
      const items: { label: string; value: string; note?: string; color?: string }[] = [];
      if (data.budget) {
        const used = data.budget.plannedCents > ZERO ? Number((data.budget.actualCents * BigInt(10000)) / data.budget.plannedCents) : 0;
        items.push({ label: "Orçamento do mês", value: money(data.budget.plannedCents), note: `gasto ${money(data.budget.actualCents)} (${percent(used)})` });
        items.push({ label: "Categorias acima do orçado", value: String(data.budget.overCount), color: data.budget.overCount > 0 ? COLORS.negative : COLORS.ink });
      }
      if (data.savings) items.push({ label: "Guardado nos cofrinhos", value: money(data.savings.savedCents), note: `${data.savings.activeCount} cofrinho(s) · metas de ${money(data.savings.targetCents)}` });
      boxes(items);
    }

    paragraph(`Resultado por competência (receitas e despesas do mês, pagas ou não). Caixa pelas baixas registradas no mês. Contas a receber e projeção na posição de ${dateBr(data.generatedOn)}: a projeção soma o saldo disponível de hoje e os títulos em aberto até 30 dias, como no painel.`);

    doc.page.margins.bottom = 0;
    doc.fillColor(COLORS.muted).font("Helvetica").fontSize(8).text(`Gerado pelo AX Finance em ${dateBr(data.generatedOn)}.`, left, doc.page.height - doc.page.margins.bottom - 12, { width, align: "center", lineBreak: false });
    doc.end();
  });
}

/** Até este dia do mês o relatório do mês anterior ainda é enviado (cobre worker parado ou fim de semana). */
export const MONTHLY_REPORT_SEND_UNTIL_DAY = 5;
const MONTHLY_REPORT_ROLES = new Set(["OWNER", "FINANCE_ADMIN", "ACCOUNTANT"]);

/**
 * Tarefa agendada (roda de hora em hora): nos primeiros dias do mês, enfileira o e-mail com o PDF do
 * mês anterior para quem vê a empresa inteira (proprietário, administrador financeiro e contador, sem
 * acesso restrito) e deixou a opção ligada, a partir do horário de entrega escolhido. A chave de
 * deduplicação garante um e-mail por pessoa por mês.
 */
export async function generateMonthlyReports(userId: string, companyId: string, baseUrl: string, now = new Date()) {
  await assertActiveMembership(userId, companyId);
  return withCompanyContext(userId, companyId, async (tx) => {
    const company = await tx.company.findUniqueOrThrow({ where: { id: companyId }, select: { name: true, timezone: true } });
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: company.timezone || "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false }).formatToParts(now).map((part) => [part.type, part.value]));
    const day = Number(parts.day);
    const hour = Number(parts.hour) % 24;
    if (day > MONTHLY_REPORT_SEND_UNTIL_DAY) return { emailsQueued: 0 };
    const month = previousMonth(`${parts.year}-${parts.month}`);

    const [memberships, preferences] = await Promise.all([
      tx.membership.findMany({ where: { companyId, status: "ACTIVE" }, include: { user: { select: { id: true, email: true, name: true, emailVerifiedAt: true } } } }),
      tx.notificationPreference.findMany({ where: { companyId } }),
    ]);
    const preferenceOf = new Map(preferences.map((preference) => [preference.userId, preference]));
    let emailsQueued = 0;
    for (const membership of memberships) {
      if (!MONTHLY_REPORT_ROLES.has(membership.role) || membership.accessScope === "RESTRICTED" || !membership.user.emailVerifiedAt) continue;
      const preference = preferenceOf.get(membership.userId);
      if (preference && !preference.emailMonthlyReport) continue;
      if (hour < (preference?.deliveryHour ?? 8)) continue;
      const queued = await enqueueMonthlyReportEmail(tx, `monthly-report:${companyId}:${membership.userId}:${month}`, {
        to: membership.user.email,
        name: membership.user.name,
        companyName: company.name,
        baseUrl,
        companyId,
        userId: membership.userId,
        month,
      });
      emailsQueued += queued.count;
    }
    return { emailsQueued };
  });
}

/** "Enviar para meu e-mail agora": mesmo e-mail do envio automático, para a própria pessoa (precisa ver a empresa inteira). */
export async function queueMonthlyReportForUser(userId: string, companyId: string, rawMonth: string, baseUrl: string) {
  const month = monthInput.parse(rawMonth);
  const membership = await assertActiveMembership(userId, companyId);
  if (membership.accessScope === "RESTRICTED") throw new CompanyAccessScopeInvalidError();
  return withCompanyContext(userId, companyId, async (tx) => {
    const [company, user] = await Promise.all([
      tx.company.findUniqueOrThrow({ where: { id: companyId }, select: { name: true } }),
      tx.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true, name: true } }),
    ]);
    // chave por minuto: evita duplo clique sem impedir um novo pedido mais tarde
    const minute = new Date().toISOString().slice(0, 16);
    return enqueueMonthlyReportEmail(tx, `monthly-report-now:${companyId}:${userId}:${month}:${minute}`, {
      to: user.email, name: user.name, companyName: company.name, baseUrl, companyId, userId, month,
    });
  });
}
