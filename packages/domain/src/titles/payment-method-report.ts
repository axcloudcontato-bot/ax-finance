import { z } from "zod";
import { withCompanyContext } from "@ax-finance/db";
import { assertActiveMembership } from "../companies/assert-membership";
import { settlementCashDelta } from "./settlement-cash-delta";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABEL, type PaymentMethodKey } from "./title-details";

const input = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const PAYMENT_METHOD_NONE = "NAO_INFORMADO";
export const PAYMENT_METHOD_FREE_TEXT = "TEXTO_LIVRE";

const ZERO = BigInt(0);
const plain = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
const BY_TEXT = new Map<string, PaymentMethodKey>(
  PAYMENT_METHODS.flatMap((key) => [[plain(key), key] as const, [plain(PAYMENT_METHOD_LABEL[key]), key] as const]),
);

/** A baixa guarda a forma como texto (o rótulo escolhido ou o texto livre antigo): leva à chave, ou agrupa como texto livre. */
function methodOfSettlementText(text: string | null | undefined): string {
  if (!text?.trim()) return PAYMENT_METHOD_NONE;
  return BY_TEXT.get(plain(text)) ?? PAYMENT_METHOD_FREE_TEXT;
}

export const PAYMENT_METHOD_REPORT_LABEL: Record<string, string> = {
  ...PAYMENT_METHOD_LABEL,
  [PAYMENT_METHOD_NONE]: "Não informado",
  [PAYMENT_METHOD_FREE_TEXT]: "Outras (texto livre)",
};

interface Row {
  key: string;
  label: string;
  /** Realizado: dinheiro que entrou e saiu pelas baixas do período, por forma de pagamento da baixa. */
  receivedCents: bigint;
  paidCents: bigint;
  settlementCount: number;
  /** Previsto: o que está em aberto com vencimento no período, pela forma prevista no lançamento. */
  openReceivableCents: bigint;
  openPayableCents: bigint;
  openCount: number;
}

/**
 * Entradas e saídas por forma de pagamento (PIX, boleto, cartão...):
 *  - realizado: baixas do período (data efetiva, sem estornadas), pelo meio de pagamento informado na baixa;
 *  - previsto: títulos em aberto com vencimento no período, pela forma de pagamento prevista no lançamento.
 * "Não informado" mostra o quanto ainda falta classificar. Só leitura.
 */
export async function getPaymentMethodReport(userId: string, companyId: string, rawInput: unknown) {
  const data = input.parse(rawInput);
  await assertActiveMembership(userId, companyId);
  const range = { gte: new Date(`${data.from}T00:00:00Z`), lte: new Date(`${data.to}T00:00:00Z`) };

  return withCompanyContext(userId, companyId, async (tx) => {
    const [settlements, openTitles] = await Promise.all([
      tx.settlement.findMany({
        where: { companyId, reversedAt: null, effectiveDate: range },
        select: { paymentMethod: true, principalAmountCents: true, interestPenaltyCents: true, feesCents: true, title: { select: { type: true } } },
      }),
      tx.title.findMany({
        where: { companyId, deletedAt: null, status: { in: ["OPEN", "PARTIALLY_SETTLED"] }, dueDate: range, creditCardInvoice: null },
        select: {
          type: true, expectedPaymentMethod: true, originalAmountCents: true,
          settlements: { where: { reversedAt: null }, select: { principalAmountCents: true, discountCents: true } },
        },
      }),
    ]);

    const rows = new Map<string, Row>();
    const row = (key: string): Row => {
      let existing = rows.get(key);
      if (!existing) {
        existing = { key, label: PAYMENT_METHOD_REPORT_LABEL[key] ?? key, receivedCents: ZERO, paidCents: ZERO, settlementCount: 0, openReceivableCents: ZERO, openPayableCents: ZERO, openCount: 0 };
        rows.set(key, existing);
      }
      return existing;
    };

    for (const settlement of settlements) {
      const entry = row(methodOfSettlementText(settlement.paymentMethod));
      const delta = settlementCashDelta(settlement.title.type, settlement);
      if (settlement.title.type === "RECEIVABLE") entry.receivedCents += delta;
      else entry.paidCents += -delta;
      entry.settlementCount += 1;
    }
    for (const title of openTitles) {
      const remaining = title.originalAmountCents - title.settlements.reduce((sum, item) => sum + item.principalAmountCents + item.discountCents, ZERO);
      if (remaining <= ZERO) continue;
      const key = title.expectedPaymentMethod && (PAYMENT_METHODS as readonly string[]).includes(title.expectedPaymentMethod) ? title.expectedPaymentMethod : PAYMENT_METHOD_NONE;
      const entry = row(key);
      if (title.type === "RECEIVABLE") entry.openReceivableCents += remaining;
      else entry.openPayableCents += remaining;
      entry.openCount += 1;
    }

    const list = [...rows.values()].sort((left, right) => {
      const volume = (item: Row) => item.receivedCents + item.paidCents + item.openReceivableCents + item.openPayableCents;
      return volume(right) > volume(left) ? 1 : volume(right) < volume(left) ? -1 : left.label.localeCompare(right.label);
    });
    const sum = (pick: (item: Row) => bigint) => list.reduce((total, item) => total + pick(item), ZERO);
    return {
      rows: list,
      totals: {
        receivedCents: sum((item) => item.receivedCents),
        paidCents: sum((item) => item.paidCents),
        openReceivableCents: sum((item) => item.openReceivableCents),
        openPayableCents: sum((item) => item.openPayableCents),
      },
    };
  });
}
