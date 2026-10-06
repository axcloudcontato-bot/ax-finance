import type { TenantScopedClient } from "@ax-finance/db";
import {
  CompanyAccessDeniedError,
  CreditCardAccessRestrictedError,
  CreditCardInvoiceBelowSettledError,
  CreditCardInvoiceNotPayableError,
  TitleManagedByCreditCardError,
} from "../errors";
import { formatReferenceMonth, todayInTimeZone, type InvoiceCycle } from "./invoice-cycle";

export const CARD_INVOICE_CATEGORY_NAME = "Fatura de cartão de crédito";

/**
 * A fatura agrega compras de vários centros de custo, e o título dela não tem centro. Por isso
 * só quem tem acesso total (proprietário ou escopo "ALL") opera cartão — mesma regra da RLS
 * (`app_can_access_cost_center(company, NULL)`), conferida aqui para devolver um erro claro.
 */
export async function assertCardAccess(tx: TenantScopedClient, userId: string, companyId: string) {
  const membership = await tx.membership.findUnique({ where: { userId_companyId: { userId, companyId } } });
  if (!membership) throw new CompanyAccessDeniedError();
  if (membership.role !== "OWNER" && membership.accessScope === "RESTRICTED") throw new CreditCardAccessRestrictedError();
}

/** Título que representa uma fatura não pode ser editado/cancelado/excluído à mão: o valor vem das compras. */
export async function assertTitleNotCardInvoice(tx: TenantScopedClient, companyId: string, titleId: string) {
  const invoice = await tx.creditCardInvoice.findFirst({ where: { companyId, titleId }, select: { id: true } });
  if (invoice) throw new TitleManagedByCreditCardError();
}

/** "Hoje" no fuso cadastrado da empresa; os testes passam `today` explicitamente. */
export async function companyToday(tx: TenantScopedClient, companyId: string): Promise<string> {
  const company = await tx.company.findUnique({ where: { id: companyId }, select: { timezone: true } });
  return todayInTimeZone(company?.timezone ?? "America/Sao_Paulo");
}

/**
 * Título de fatura só recebe pagamento depois do fechamento: uma fatura ainda aberta mudaria de
 * valor depois de paga. Vale para toda baixa (tela do título e baixa em lote), não só para "Pagar fatura".
 */
export async function assertInvoiceTitlePayable(tx: TenantScopedClient, companyId: string, titleId: string) {
  const invoice = await tx.creditCardInvoice.findFirst({ where: { companyId, titleId }, select: { closingDate: true } });
  if (!invoice) return;
  const closingDate = invoice.closingDate.toISOString().slice(0, 10);
  if ((await companyToday(tx, companyId)) < closingDate) throw new CreditCardInvoiceNotPayableError(closingDate);
}

async function getInvoiceCategoryId(tx: TenantScopedClient, companyId: string): Promise<string> {
  const existing = await tx.category.findFirst({ where: { companyId, name: CARD_INVOICE_CATEGORY_NAME }, select: { id: true } });
  if (existing) return existing.id;
  const created = await tx.category.create({
    data: { companyId, name: CARD_INVOICE_CATEGORY_NAME, nature: "EXPENSE", managerialGroup: "Cartão de crédito" },
    select: { id: true },
  });
  return created.id;
}

export function invoiceDescription(cardName: string, referenceMonth: string): string {
  return `Fatura ${cardName} · ${formatReferenceMonth(referenceMonth)}`;
}

/**
 * Devolve a fatura do ciclo, criando-a (com o título a pagar) na primeira compra. O ciclo
 * gravado é mantido mesmo que o cartão mude de dia depois: mudar fechamento/vencimento só vale
 * para faturas ainda não criadas.
 */
export async function ensureInvoice(
  tx: TenantScopedClient,
  companyId: string,
  card: { id: string; name: string },
  cycle: InvoiceCycle,
) {
  const existing = await tx.creditCardInvoice.findUnique({
    where: { cardId_referenceMonth: { cardId: card.id, referenceMonth: cycle.referenceMonth } },
    include: { title: { select: { status: true } } },
  });
  if (existing) return existing;

  const categoryId = await getInvoiceCategoryId(tx, companyId);
  const title = await tx.title.create({
    data: {
      companyId,
      type: "PAYABLE",
      description: invoiceDescription(card.name, cycle.referenceMonth),
      categoryId,
      originalAmountCents: BigInt(0),
      competenceDate: new Date(cycle.closingDate),
      dueDate: new Date(cycle.dueDate),
    },
  });
  return tx.creditCardInvoice.create({
    data: {
      companyId,
      cardId: card.id,
      referenceMonth: cycle.referenceMonth,
      closingDate: new Date(cycle.closingDate),
      dueDate: new Date(cycle.dueDate),
      titleId: title.id,
    },
    include: { title: { select: { status: true } } },
  });
}

/**
 * Mantém o título da fatura igual à soma das compras ativas. Trava a linha do título (mesma
 * proteção de `registerSettlement`) para que uma baixa concorrente não leia o total antigo.
 *
 * - total 0: título cancelado e escondido das telas (fatura sem compras não é obrigação);
 * - total < já pago: recusa, porque deixaria o título "pago a mais";
 * - senão o status volta a ser calculado a partir do que já foi baixado.
 */
export async function syncInvoiceTitle(tx: TenantScopedClient, companyId: string, invoiceId: string, actorUserId: string) {
  const invoice = await tx.creditCardInvoice.findFirstOrThrow({
    where: { id: invoiceId, companyId },
    include: { card: { select: { name: true } } },
  });

  await tx.$queryRaw`SELECT id FROM "titles" WHERE id = ${invoice.titleId} AND company_id = ${companyId} FOR UPDATE`;

  const [purchases, settlements] = await Promise.all([
    tx.creditCardPurchase.aggregate({ where: { companyId, invoiceId, canceledAt: null }, _sum: { amountCents: true } }),
    tx.settlement.findMany({ where: { titleId: invoice.titleId, reversedAt: null } }),
  ]);
  const total = purchases._sum.amountCents ?? BigInt(0);
  const settled = settlements.reduce((sum, item) => sum + item.principalAmountCents + item.discountCents, BigInt(0));
  if (total < settled) throw new CreditCardInvoiceBelowSettledError(invoice.referenceMonth);

  const status = total === BigInt(0) ? "CANCELLED" : settled === BigInt(0) ? "OPEN" : settled >= total ? "SETTLED" : "PARTIALLY_SETTLED";
  const empty = total === BigInt(0);
  await tx.title.update({
    where: { id: invoice.titleId },
    data: {
      description: invoiceDescription(invoice.card.name, invoice.referenceMonth),
      originalAmountCents: total,
      competenceDate: invoice.closingDate,
      dueDate: invoice.dueDate,
      status,
      cancelReason: empty ? "Fatura sem compras" : null,
      // A restrição de soft delete do banco exige quem apagou e o motivo junto com a data.
      deletedAt: empty ? new Date() : null,
      deletedByUserId: empty ? actorUserId : null,
      deleteReason: empty ? "Fatura sem compras" : null,
    },
  });
  return { totalCents: total, settledCents: settled, status };
}
