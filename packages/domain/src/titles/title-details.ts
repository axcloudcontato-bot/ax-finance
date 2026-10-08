import { z } from "zod";
import type { TenantScopedClient } from "@ax-finance/db";
import { FinancialAccountNotFoundError } from "../errors";
import { OPERATIONAL_ACCOUNT } from "../financial-accounts/operational";

/** Forma de pagamento prevista no lançamento (a baixa continua aceitando texto livre). */
export const PAYMENT_METHODS = ["PIX", "BOLETO", "TRANSFERENCIA", "CARTAO", "DINHEIRO", "DEBITO_AUTOMATICO", "CHEQUE", "OUTRO"] as const;
export type PaymentMethodKey = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABEL: Record<PaymentMethodKey, string> = {
  PIX: "PIX",
  BOLETO: "Boleto",
  TRANSFERENCIA: "Transferência (TED/DOC)",
  CARTAO: "Cartão",
  DINHEIRO: "Dinheiro",
  DEBITO_AUTOMATICO: "Débito automático",
  CHEQUE: "Cheque",
  OUTRO: "Outro",
};

/** Texto da forma de pagamento para exibir e preencher a baixa; aceita o texto livre antigo sem quebrar. */
export function paymentMethodLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  return PAYMENT_METHOD_LABEL[value as PaymentMethodKey] ?? value;
}

/** Campos operacionais do lançamento. `null` limpa o valor; omitir deixa como está (na edição). */
export const titleDetailsShape = {
  expectedAccountId: z.string().uuid().nullish(),
  documentNumber: z.string().trim().max(60).nullish(),
  expectedPaymentMethod: z.enum(PAYMENT_METHODS).nullish(),
  paymentCode: z.string().trim().max(200).nullish(),
};

export async function assertExpectedAccount(tx: TenantScopedClient, companyId: string, accountId: string | null | undefined) {
  if (!accountId) return;
  const account = await tx.financialAccount.findFirst({ where: { id: accountId, companyId, status: "ACTIVE", ...OPERATIONAL_ACCOUNT }, select: { id: true } });
  if (!account) throw new FinancialAccountNotFoundError();
}
