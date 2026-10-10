export type AmortizationKind = "PRICE" | "SAC";

export interface ScheduleRow {
  number: number;
  paymentCents: bigint;
  interestCents: bigint;
  amortizationCents: bigint;
  /** Saldo devedor depois desta parcela. */
  balanceCents: bigint;
}

const ZERO = BigInt(0);

/**
 * Tabela de amortização em centavos inteiros.
 * - PRICE: parcela fixa = P·i / (1 − (1+i)^−n); juros caem e a amortização sobe.
 * - SAC: amortização fixa = P/n; a parcela começa maior e cai.
 * Juros de cada mês = saldo anterior × taxa, arredondados ao centavo. A última parcela fecha o saldo em zero.
 */
export function amortizationSchedule(input: { principalCents: bigint; monthlyRateBps: number; count: number; system: AmortizationKind }): ScheduleRow[] {
  const { principalCents, monthlyRateBps, count, system } = input;
  if (count < 1 || principalCents <= ZERO) return [];
  const rate = monthlyRateBps / 10_000;
  const rows: ScheduleRow[] = [];
  let balance = principalCents;
  const fixedPayment = system === "PRICE"
    ? rate === 0
      ? Number(principalCents) / count
      : (Number(principalCents) * rate) / (1 - Math.pow(1 + rate, -count))
    : 0;
  const fixedAmortization = system === "SAC" ? principalCents / BigInt(count) : ZERO;

  for (let number = 1; number <= count; number += 1) {
    const interest = BigInt(Math.round(Number(balance) * rate));
    let amortization: bigint;
    if (number === count) amortization = balance;
    else if (system === "PRICE") amortization = BigInt(Math.round(fixedPayment)) - interest;
    else amortization = fixedAmortization;
    if (amortization > balance) amortization = balance;
    if (amortization < ZERO) amortization = ZERO;
    balance -= amortization;
    rows.push({ number, paymentCents: amortization + interest, interestCents: interest, amortizationCents: amortization, balanceCents: balance });
  }
  return rows;
}

/** Saldo devedor depois de `paid` parcelas pagas (0 = o valor contratado). */
export function balanceAfter(schedule: ScheduleRow[], principalCents: bigint, paid: number): bigint {
  if (paid <= 0) return principalCents;
  return schedule[Math.min(paid, schedule.length) - 1]?.balanceCents ?? ZERO;
}
