import { z } from "zod";
import { withCompanyContext } from "@ax-finance/db";
import { assertCompanyPermission } from "../companies/permissions";
import { CreditCardInvoiceNotFoundError, CreditCardInvoiceNotPayableError, CreditCardInvoicePaidError } from "../errors";
import { idempotencyKeySchema } from "../idempotency/operations";
import { registerSettlement } from "../titles/register-settlement";
import { companyToday } from "../shared/today";
import { assertCardAccess } from "./invoices";
import { invoiceStage } from "./invoice-cycle";

export const payCreditCardInvoiceInput = z.object({
  financialAccountId: z.string().uuid(),
  /** Vazio = paga o saldo todo da fatura. Menor que o saldo = pagamento parcial. */
  amountCents: z.number().int().positive().optional(),
  interestPenaltyCents: z.number().int().min(0).default(0),
  feesCents: z.number().int().min(0).default(0),
  effectiveDate: z.coerce.date(),
  notes: z.string().trim().max(2000).optional(),
  idempotencyKey: idempotencyKeySchema,
});

/**
 * Pagar a fatura é uma baixa comum do título dela (`registerSettlement`): sai dinheiro da conta
 * escolhida na data efetiva, vale pagamento parcial, juros e encargos entram nos campos próprios
 * e o estorno e a conciliação com o extrato funcionam como em qualquer outra baixa.
 * Só se paga fatura já fechada: a que ainda recebe compras mudaria de valor depois do pagamento.
 */
export async function payCreditCardInvoice(userId: string, companyId: string, invoiceId: string, input: unknown) {
  const data = payCreditCardInvoiceInput.parse(input);
  await assertCompanyPermission(userId, companyId, "FINANCE_WRITE");

  const target = await withCompanyContext(userId, companyId, async (tx) => {
    await assertCardAccess(tx, userId, companyId);
    const invoice = await tx.creditCardInvoice.findFirst({
      where: { id: invoiceId, companyId },
      include: { card: true, title: { include: { settlements: { where: { reversedAt: null } } } } },
    });
    if (!invoice) throw new CreditCardInvoiceNotFoundError();
    const remainingCents = invoice.title.originalAmountCents - invoice.title.settlements.reduce((sum, item) => sum + item.principalAmountCents + item.discountCents, BigInt(0));
    if (remainingCents <= BigInt(0)) throw new CreditCardInvoicePaidError(invoice.referenceMonth);

    const closingDate = invoice.closingDate.toISOString().slice(0, 10);
    const stage = invoiceStage(
      invoice.card,
      { referenceMonth: invoice.referenceMonth, closingDate, dueDate: invoice.dueDate.toISOString().slice(0, 10) },
      remainingCents,
      await companyToday(tx, companyId),
      invoice.title.originalAmountCents,
    );
    if (stage === "OPEN" || stage === "FUTURE") throw new CreditCardInvoiceNotPayableError(closingDate);
    return { titleId: invoice.titleId, remainingCents };
  });

  const { amountCents, ...rest } = data;
  return registerSettlement(userId, companyId, target.titleId, {
    ...rest,
    principalAmountCents: amountCents ?? Number(target.remainingCents),
    paymentMethod: "Fatura de cartão de crédito",
  });
}
