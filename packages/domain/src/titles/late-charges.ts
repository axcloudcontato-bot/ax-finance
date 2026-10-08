/**
 * Multa e juros de atraso sugeridos para um recebível: multa de uma vez e juros ao mês proporcionais
 * aos dias de atraso (simples, mês de 30 dias). É só sugestão para preencher a baixa; a pessoa confere
 * e pode trocar o valor. Percentuais em pontos-base (200 = 2%).
 */
export function suggestLateCharges(input: {
  remainingCents: bigint;
  /** "YYYY-MM-DD" */
  dueDate: string;
  effectiveDate: string;
  lateFeeBps: number;
  lateInterestMonthlyBps: number;
}) {
  const days = Math.max(0, Math.round((Date.parse(`${input.effectiveDate}T00:00:00Z`) - Date.parse(`${input.dueDate}T00:00:00Z`)) / 86_400_000));
  const zero = BigInt(0);
  if (days === 0 || input.remainingCents <= zero || (input.lateFeeBps === 0 && input.lateInterestMonthlyBps === 0)) {
    return { days, feeCents: zero, interestCents: zero, totalCents: zero };
  }
  const feeDenominator = BigInt(10_000);
  const feeCents = (input.remainingCents * BigInt(input.lateFeeBps) + feeDenominator / BigInt(2)) / feeDenominator;
  const interestDenominator = BigInt(10_000 * 30);
  const interestCents = (input.remainingCents * BigInt(input.lateInterestMonthlyBps) * BigInt(days) + interestDenominator / BigInt(2)) / interestDenominator;
  return { days, feeCents, interestCents, totalCents: feeCents + interestCents };
}
