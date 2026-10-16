import { z } from "zod";
import { withCompanyContext } from "@ax-finance/db";
import { assertCompanyPermission } from "../companies/permissions";
import {
  CreditCardAnticipationDateError,
  CreditCardAnticipationExceedsError,
  CreditCardInvoiceNotAnticipatableError,
  CreditCardInvoiceNotFoundError,
  CreditCardInvoicePaidError,
  IdempotencyResultUnavailableError,
} from "../errors";
import { beginIdempotentOperation, completeIdempotentOperation, idempotencyKeySchema } from "../idempotency/operations";
import { registerSettlementInTx } from "../titles/register-settlement";
import { companyToday } from "../shared/today";
import { assertCardAccess } from "./invoices";
import { invoiceStage } from "./invoice-cycle";

export const ANTICIPATION_PAYMENT_METHOD = "Antecipação de fatura de cartão";

export const anticipateCreditCardInvoiceInput = z.object({
  financialAccountId: z.string().uuid(),
  /** Valor livre, até o que a fatura soma hoje. */
  amountCents: z.number().int().positive(),
  effectiveDate: z.coerce.date(),
  notes: z.string().trim().max(2000).optional(),
  idempotencyKey: idempotencyKeySchema,
});

/**
 * Antecipar a fatura: pagar parte (ou tudo) de uma fatura que ainda não fechou — a do ciclo em
 * andamento ou uma futura com parcelas. É uma baixa comum do título da fatura (sai da conta na data,
 * libera limite, pode ser estornada e conciliada); só pula a trava de "fatura aberta", que existe
 * para o pagamento normal. O valor vai até o total que a fatura tem agora; novas compras somam ao
 * total e, no fechamento, falta pagar só a diferença. Cancelar compras que deixem o total abaixo do
 * já antecipado continua recusado (`syncInvoiceTitle`): é preciso estornar a antecipação antes.
 */
export async function anticipateCreditCardInvoice(userId: string, companyId: string, invoiceId: string, input: unknown) {
  const data = anticipateCreditCardInvoiceInput.parse(input);
  await assertCompanyPermission(userId, companyId, "FINANCE_WRITE");

  return withCompanyContext(userId, companyId, async (tx) => {
    await assertCardAccess(tx, userId, companyId);
    const { idempotencyKey, ...request } = data;
    const operation = await beginIdempotentOperation(tx, {
      companyId, operation: `ANTICIPATE_CARD_INVOICE:${invoiceId}`, key: idempotencyKey,
      request, resourceType: "Settlement",
    });
    if (operation.kind === "replay") {
      const existing = await tx.settlement.findFirst({ where: { id: operation.resourceId, companyId } });
      if (!existing) throw new IdempotencyResultUnavailableError();
      return existing;
    }
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
    if (stage !== "OPEN" && stage !== "FUTURE") throw new CreditCardInvoiceNotAnticipatableError(closingDate);
    if (data.effectiveDate.toISOString().slice(0, 10) >= closingDate) throw new CreditCardAnticipationDateError(closingDate);

    if (BigInt(data.amountCents) > remainingCents) throw new CreditCardAnticipationExceedsError(remainingCents);
    const payment = await registerSettlementInTx(tx, userId, companyId, invoice.titleId, {
      financialAccountId: data.financialAccountId,
      principalAmountCents: data.amountCents,
      discountCents: 0,
      interestPenaltyCents: 0,
      feesCents: 0,
      effectiveDate: data.effectiveDate,
      notes: data.notes,
      paymentMethod: ANTICIPATION_PAYMENT_METHOD,
    }, { allowOpenCardInvoice: true });
    await completeIdempotentOperation(tx, operation, payment.id);
    return payment;
  });
}
