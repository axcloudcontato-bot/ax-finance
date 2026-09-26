/**
 * Efeito de caixa de uma baixa (exemplo da Seção 6 — título de R$1.000,
 * R$400 quitados, R$8 de taxa retida: banco recebe R$392, o principal do
 * título continua R$400, mas o CAIXA que entra na conta é diferente):
 *   entrada (RECEIVABLE): +principal +juros/multa −taxas
 *   saída   (PAYABLE):    −principal −juros/multa −taxas
 * (desconto nunca move caixa, só reduz o que era devido)
 *
 * Usado tanto pelo saldo por conta (financial-accounts/account-balances.ts)
 * quanto pelo relatório de fluxo de caixa — mesma regra, uma só definição.
 */
export function settlementCashDelta(
  titleType: "RECEIVABLE" | "PAYABLE",
  settlement: {
    principalAmountCents: bigint;
    interestPenaltyCents: bigint;
    feesCents: bigint;
  }
): bigint {
  return titleType === "RECEIVABLE"
    ? settlement.principalAmountCents + settlement.interestPenaltyCents - settlement.feesCents
    : -(settlement.principalAmountCents + settlement.interestPenaltyCents + settlement.feesCents);
}
