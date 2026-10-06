import { withCompanyContext } from "@ax-finance/db";
import { assertActiveMembership } from "../companies/assert-membership";
import { CreditCardInvoiceNotFoundError, CreditCardNotFoundError } from "../errors";
import { assertCardAccess, companyToday } from "./invoices";
import { cycleForPurchaseDate, invoiceStage, type InvoiceStage } from "./invoice-cycle";

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

const ZERO = BigInt(0);

function remainingOf(title: { originalAmountCents: bigint; settlements: { principalAmountCents: bigint; discountCents: bigint }[] }): bigint {
  return title.originalAmountCents - title.settlements.reduce((sum, item) => sum + item.principalAmountCents + item.discountCents, ZERO);
}

export interface CreditCardInvoiceSummary {
  id: string;
  referenceMonth: string;
  closingDate: string;
  dueDate: string;
  titleId: string;
  totalCents: bigint;
  paidCents: bigint;
  remainingCents: bigint;
  stage: InvoiceStage;
  purchaseCount: number;
}

/**
 * Cartões com o resumo que a tela de lista precisa: limite usado/disponível, a fatura em
 * andamento e a próxima a pagar.
 *
 * Limite usado = o que ainda falta pagar em TODAS as faturas do cartão, inclusive as futuras: o
 * banco reserva do limite o total de uma compra parcelada, não só a parcela do mês.
 */
export async function listCreditCards(userId: string, companyId: string, options: { includeArchived?: boolean; today?: string } = {}) {
  await assertActiveMembership(userId, companyId);

  return withCompanyContext(userId, companyId, async (tx) => {
    await assertCardAccess(tx, userId, companyId);
    const todayValue = options.today ?? (await companyToday(tx, companyId));
    const cards = await tx.creditCard.findMany({
      where: { companyId, ...(options.includeArchived ? {} : { status: "ACTIVE" }) },
      orderBy: [{ status: "asc" }, { name: "asc" }],
      include: { defaultPaymentAccount: { select: { id: true, name: true } } },
    });
    const pending = await tx.creditCardInvoice.findMany({
      where: { companyId, cardId: { in: cards.map((card) => card.id) }, title: { status: { in: ["OPEN", "PARTIALLY_SETTLED"] } } },
      include: { title: { include: { settlements: { where: { reversedAt: null } } } } },
      orderBy: { dueDate: "asc" },
    });

    return cards.map((card) => {
      const invoices = pending
        .filter((invoice) => invoice.cardId === card.id)
        .map((invoice) => {
          const remainingCents = remainingOf(invoice.title);
          const closingDate = dateOnly(invoice.closingDate);
          const dueDate = dateOnly(invoice.dueDate);
          return {
            id: invoice.id,
            referenceMonth: invoice.referenceMonth,
            closingDate,
            dueDate,
            totalCents: invoice.title.originalAmountCents,
            remainingCents,
            stage: invoiceStage(card, { referenceMonth: invoice.referenceMonth, closingDate, dueDate }, remainingCents, todayValue, invoice.title.originalAmountCents),
          };
        });
      const usedLimitCents = invoices.reduce((sum, invoice) => sum + invoice.remainingCents, ZERO);
      const openCycle = cycleForPurchaseDate(card, todayValue);
      const openInvoice = invoices.find((invoice) => invoice.stage === "OPEN") ?? null;
      const nextPayable = invoices.find((invoice) => invoice.stage === "CLOSED" || invoice.stage === "OVERDUE") ?? null;
      return {
        ...card,
        usedLimitCents,
        availableLimitCents: card.limitCents - usedLimitCents,
        /** Ciclo em andamento (existe mesmo antes da 1ª compra) e o que já foi lançado nele. */
        openCycle: { ...openCycle, invoiceId: openInvoice?.id ?? null, totalCents: openInvoice?.totalCents ?? ZERO },
        nextPayable,
        overdueCount: invoices.filter((invoice) => invoice.stage === "OVERDUE").length,
      };
    });
  });
}

/** Um cartão com todas as faturas que têm compras (futuras, abertas, fechadas e pagas). */
export async function getCreditCard(userId: string, companyId: string, cardId: string, options: { today?: string } = {}) {
  await assertActiveMembership(userId, companyId);

  return withCompanyContext(userId, companyId, async (tx) => {
    await assertCardAccess(tx, userId, companyId);
    const todayValue = options.today ?? (await companyToday(tx, companyId));
    const card = await tx.creditCard.findFirst({
      where: { id: cardId, companyId },
      include: { defaultPaymentAccount: { select: { id: true, name: true } } },
    });
    if (!card) throw new CreditCardNotFoundError();

    const rows = await tx.creditCardInvoice.findMany({
      where: { companyId, cardId: card.id, purchases: { some: { canceledAt: null } } },
      include: {
        title: { include: { settlements: { where: { reversedAt: null } } } },
        _count: { select: { purchases: { where: { canceledAt: null } } } },
      },
      orderBy: { dueDate: "desc" },
    });

    const invoices: CreditCardInvoiceSummary[] = rows.map((invoice) => {
      const remainingCents = remainingOf(invoice.title);
      const closingDate = dateOnly(invoice.closingDate);
      const dueDate = dateOnly(invoice.dueDate);
      return {
        id: invoice.id,
        referenceMonth: invoice.referenceMonth,
        closingDate,
        dueDate,
        titleId: invoice.titleId,
        totalCents: invoice.title.originalAmountCents,
        paidCents: invoice.title.originalAmountCents - remainingCents,
        remainingCents,
        stage: invoiceStage(card, { referenceMonth: invoice.referenceMonth, closingDate, dueDate }, remainingCents, todayValue, invoice.title.originalAmountCents),
        purchaseCount: invoice._count.purchases,
      };
    });

    const usedLimitCents = invoices.reduce((sum, invoice) => sum + invoice.remainingCents, ZERO);
    return {
      card,
      invoices,
      usedLimitCents,
      availableLimitCents: card.limitCents - usedLimitCents,
      openCycle: cycleForPurchaseDate(card, todayValue),
    };
  });
}

/**
 * Detalhe da fatura: compras ativas (e as canceladas, à parte), total por categoria para ver
 * onde o dinheiro foi, e o histórico de pagamentos do título.
 */
export async function getCreditCardInvoice(userId: string, companyId: string, invoiceId: string, options: { today?: string } = {}) {
  await assertActiveMembership(userId, companyId);

  return withCompanyContext(userId, companyId, async (tx) => {
    await assertCardAccess(tx, userId, companyId);
    const todayValue = options.today ?? (await companyToday(tx, companyId));
    const invoice = await tx.creditCardInvoice.findFirst({
      where: { id: invoiceId, companyId },
      include: {
        card: true,
        title: { include: { settlements: { include: { financialAccount: { select: { id: true, name: true } } }, orderBy: { effectiveDate: "asc" } } } },
        purchases: {
          include: { category: { select: { id: true, name: true } }, costCenter: { select: { id: true, name: true } }, party: { select: { id: true, name: true } } },
          orderBy: [{ purchaseDate: "asc" }, { createdAt: "asc" }],
        },
      },
    });
    if (!invoice) throw new CreditCardInvoiceNotFoundError();

    const activeSettlements = invoice.title.settlements.filter((settlement) => !settlement.reversedAt);
    const remainingCents = remainingOf({ originalAmountCents: invoice.title.originalAmountCents, settlements: activeSettlements });
    const closingDate = dateOnly(invoice.closingDate);
    const dueDate = dateOnly(invoice.dueDate);
    const purchases = invoice.purchases.filter((purchase) => !purchase.canceledAt);

    const byCategory = new Map<string, { categoryId: string; name: string; cents: bigint }>();
    for (const purchase of purchases) {
      const current = byCategory.get(purchase.categoryId);
      byCategory.set(purchase.categoryId, {
        categoryId: purchase.categoryId,
        name: purchase.category.name,
        cents: (current?.cents ?? ZERO) + purchase.amountCents,
      });
    }

    return {
      invoice: {
        id: invoice.id,
        referenceMonth: invoice.referenceMonth,
        closingDate,
        dueDate,
        titleId: invoice.titleId,
        totalCents: invoice.title.originalAmountCents,
        paidCents: invoice.title.originalAmountCents - remainingCents,
        remainingCents,
        stage: invoiceStage(invoice.card, { referenceMonth: invoice.referenceMonth, closingDate, dueDate }, remainingCents, todayValue, invoice.title.originalAmountCents),
      },
      card: invoice.card,
      purchases,
      canceledPurchases: invoice.purchases.filter((purchase) => purchase.canceledAt),
      byCategory: [...byCategory.values()].sort((left, right) => (right.cents > left.cents ? 1 : right.cents < left.cents ? -1 : 0)),
      payments: invoice.title.settlements,
    };
  });
}
