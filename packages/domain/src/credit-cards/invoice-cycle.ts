/**
 * Cálculo de ciclo de fatura, sem banco: só datas "YYYY-MM-DD" e os dois dias do cartão.
 *
 * Regras (documentadas na tela do cartão):
 * - A fatura fecha no dia de fechamento. A compra feita ANTES desse dia entra na fatura que fecha
 *   neste mês; a feita NO dia de fechamento ou depois entra na do mês seguinte (o "melhor dia de
 *   compra" é o próprio dia de fechamento).
 * - O vencimento é a primeira ocorrência do dia de vencimento depois do fechamento: no mesmo mês
 *   quando o dia de vencimento é maior que o de fechamento, senão no mês seguinte.
 * - Mês sem o dia configurado (31 em fevereiro) usa o último dia do mês, sem arrastar o ajuste
 *   para os meses seguintes (mesma regra de `addMonthsClamped`).
 * - `referenceMonth` é o mês do VENCIMENTO: "fatura de novembro" é a que vence em novembro.
 */

export interface CardDays {
  closingDay: number;
  dueDay: number;
}

export interface InvoiceCycle {
  /** "YYYY-MM" do vencimento. */
  referenceMonth: string;
  closingDate: string;
  dueDate: string;
}

function pad(value: number, size = 2): string {
  return String(value).padStart(size, "0");
}

function lastDayOf(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Normaliza (ano, mês 1-based) que pode ter estourado para fora de 1..12. */
function normalizeMonth(year: number, month: number): { year: number; month: number } {
  const index = year * 12 + (month - 1);
  return { year: Math.floor(index / 12), month: (((index % 12) + 12) % 12) + 1 };
}

function clampedDate(year: number, month: number, day: number): string {
  const normalized = normalizeMonth(year, month);
  const clampedDay = Math.min(day, lastDayOf(normalized.year, normalized.month));
  return `${pad(normalized.year, 4)}-${pad(normalized.month)}-${pad(clampedDay)}`;
}

function parseDate(value: string): { year: number; month: number; day: number } {
  const [year = 0, month = 1, day = 1] = value.split("-").map(Number);
  return { year, month, day };
}

/** Ciclo que FECHA no mês informado (ano, mês 1-based). */
export function cycleClosingInMonth(card: CardDays, year: number, month: number): InvoiceCycle {
  const closingDate = clampedDate(year, month, card.closingDay);
  let dueDate = clampedDate(year, card.dueDay > card.closingDay ? month : month + 1, card.dueDay);
  // Fevereiro pode colapsar fechamento e vencimento no mesmo dia (ex.: fecha 30, vence 31).
  if (dueDate <= closingDate) dueDate = clampedDate(year, month + 1, card.dueDay);
  return { referenceMonth: dueDate.slice(0, 7), closingDate, dueDate };
}

/** Ciclo em que cai uma compra feita em `purchaseDate`. */
export function cycleForPurchaseDate(card: CardDays, purchaseDate: string): InvoiceCycle {
  const { year, month } = parseDate(purchaseDate);
  const closingThisMonth = clampedDate(year, month, card.closingDay);
  return purchaseDate < closingThisMonth
    ? cycleClosingInMonth(card, year, month)
    : cycleClosingInMonth(card, year, month + 1);
}

/** Ciclo `months` meses depois de `cycle` (0 = o próprio), recalculado a partir dos dias do cartão. */
export function shiftCycle(card: CardDays, cycle: InvoiceCycle, months: number): InvoiceCycle {
  const { year, month } = parseDate(cycle.closingDate);
  return cycleClosingInMonth(card, year, month + months);
}

/** Um ciclo por parcela, a partir do ciclo da compra. */
export function cyclesForInstallments(card: CardDays, purchaseDate: string, installmentCount: number): InvoiceCycle[] {
  const first = cycleForPurchaseDate(card, purchaseDate);
  return Array.from({ length: installmentCount }, (_, index) => shiftCycle(card, first, index));
}

/**
 * Divide o total em N parcelas em centavos; o resto vai para as primeiras parcelas
 * (R$100/3 = 33,34 + 33,33 + 33,33), a mesma regra do parcelamento de títulos.
 */
export function splitInstallments(totalCents: number, count: number): number[] {
  const base = Math.floor(totalCents / count);
  const remainder = totalCents - base * count;
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
}

/** Competência da parcela k (0-based): o dia da compra deslocado k meses, preso ao fim do mês. */
export function installmentCompetenceDate(purchaseDate: string, index: number): string {
  const { year, month, day } = parseDate(purchaseDate);
  return clampedDate(year, month + index, day);
}

export type InvoiceStage = "OPEN" | "FUTURE" | "CLOSED" | "OVERDUE" | "PAID" | "EMPTY";

/**
 * Situação da fatura numa data. Nada disso é gravado: depende só de hoje e do saldo.
 * - EMPTY: sem compras ativas (todas canceladas); não há o que pagar nem o que travar.
 * - PAID: nada mais a pagar.
 * - OVERDUE: fechada e vencida.
 * - CLOSED: fechada, aguardando pagamento.
 * - OPEN: o ciclo em andamento, que ainda recebe compras.
 * - FUTURE: ciclos seguintes ao em andamento (parcelas já lançadas).
 */
export function invoiceStage(
  card: CardDays,
  invoice: { referenceMonth: string; closingDate: string; dueDate: string },
  remainingCents: bigint,
  today: string,
  totalCents?: bigint,
): InvoiceStage {
  if (totalCents !== undefined && totalCents === BigInt(0)) return "EMPTY";
  if (remainingCents <= BigInt(0)) return "PAID";
  if (today >= invoice.closingDate) return today > invoice.dueDate ? "OVERDUE" : "CLOSED";
  const currentOpen = cycleForPurchaseDate(card, today);
  return invoice.referenceMonth === currentOpen.referenceMonth ? "OPEN" : "FUTURE";
}

/** "2026-11" -> "11/2026". */
export function formatReferenceMonth(referenceMonth: string): string {
  const [year, month] = referenceMonth.split("-");
  return `${month}/${year}`;
}
