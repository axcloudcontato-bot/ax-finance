/**
 * Mesma regra de `suggestLateCharges` do domínio (multa de uma vez e juros ao mês proporcionais aos dias,
 * mês de 30 dias, percentuais em pontos-base), para o formulário de baixa recalcular no navegador quando
 * a pessoa troca a data ou o valor. O domínio carrega o banco de dados e não pode ir para o navegador;
 * um teste garante que as duas versões dão o mesmo resultado.
 */
export function suggestLateChargesClient(input: {
  principalCents: bigint;
  dueDate: string;
  effectiveDate: string;
  lateFeeBps: number;
  lateInterestMonthlyBps: number;
}) {
  const days = Math.max(0, Math.round((Date.parse(`${input.effectiveDate}T00:00:00Z`) - Date.parse(`${input.dueDate}T00:00:00Z`)) / 86_400_000));
  const zero = BigInt(0);
  if (!Number.isFinite(days) || days === 0 || input.principalCents <= zero || (input.lateFeeBps === 0 && input.lateInterestMonthlyBps === 0)) {
    return { days: Number.isFinite(days) ? days : 0, feeCents: zero, interestCents: zero, totalCents: zero };
  }
  const feeDenominator = BigInt(10_000);
  const feeCents = (input.principalCents * BigInt(input.lateFeeBps) + feeDenominator / BigInt(2)) / feeDenominator;
  const interestDenominator = BigInt(10_000 * 30);
  const interestCents = (input.principalCents * BigInt(input.lateInterestMonthlyBps) * BigInt(days) + interestDenominator / BigInt(2)) / interestDenominator;
  return { days, feeCents, interestCents, totalCents: feeCents + interestCents };
}
