import type { InvoiceStage } from "./invoice-cycle";

export interface PortfolioCard {
  id: string;
  name: string;
  status: string;
  limitCents: bigint;
  usedLimitCents: bigint;
  pendingInvoices: {
    id: string;
    referenceMonth: string;
    closingDate: string;
    dueDate: string;
    remainingCents: bigint;
    stage: InvoiceStage;
  }[];
}

/** Dívida não desaparece ao arquivar cartão; limite contratado só inclui os ativos. */
export function summarizeCreditCardPortfolio(cards: PortfolioCard[], today: string) {
  const zero = BigInt(0);
  const active = cards.filter((card) => card.status === "ACTIVE");
  const invoices = cards.flatMap((card) => card.pendingInvoices
    .filter((invoice) => invoice.remainingCents > zero)
    .map((invoice) => ({ ...invoice, cardId: card.id, cardName: card.name, archived: card.status === "ARCHIVED" })))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.cardName.localeCompare(b.cardName));
  const sum = (rows: typeof invoices) => rows.reduce((total, row) => total + row.remainingCents, zero);
  const end = new Date(`${today}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 30);
  const through = end.toISOString().slice(0, 10);
  const overdue = invoices.filter((invoice) => invoice.dueDate < today);
  const dueSoon = invoices.filter((invoice) => invoice.dueDate >= today && invoice.dueDate <= through);
  const [year = 0, month = 1] = today.split("-").map(Number);
  const months = Array.from({ length: 6 }, (_, index) => {
    const referenceMonth = new Date(Date.UTC(year, month - 1 + index, 1)).toISOString().slice(0, 7);
    const rows = invoices.filter((invoice) => invoice.dueDate >= today && invoice.dueDate.slice(0, 7) === referenceMonth);
    return { referenceMonth, remainingCents: sum(rows), invoiceCount: rows.length };
  });
  return {
    totalDebtCents: sum(invoices),
    totalLimitCents: active.reduce((total, card) => total + card.limitCents, zero),
    activeUsedCents: active.reduce((total, card) => total + card.usedLimitCents, zero),
    payableCents: sum(invoices.filter((invoice) => invoice.stage === "CLOSED" || invoice.stage === "OVERDUE")),
    overdueCents: sum(overdue),
    dueSoonCents: sum(dueSoon),
    dueSoonThrough: through,
    futureCents: sum(invoices.filter((invoice) => invoice.stage === "FUTURE")),
    beyondHorizonCents: sum(invoices.filter((invoice) => invoice.dueDate.slice(0, 7) > months[5]!.referenceMonth)),
    overdue,
    dueSoon,
    months,
  };
}
