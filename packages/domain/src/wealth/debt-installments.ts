import type { TenantScopedClient } from "@ax-finance/db";
import { DebtInstallmentManagedError } from "../errors";
import { amortizationSchedule, type ScheduleRow } from "./amortization";

/** Os componentes vêm dos dados estruturados do contrato, inclusive nos contratos já cadastrados. */
export async function loadDebtSchedules(tx: TenantScopedClient, companyId: string, groups: (string | null)[]) {
  const ids = [...new Set(groups.filter((id): id is string => Boolean(id)))];
  const debts = ids.length ? await tx.debt.findMany({ where: { companyId, installmentGroupId: { in: ids } } }) : [];
  return new Map(debts.map((debt) => [debt.installmentGroupId, new Map(amortizationSchedule({
    principalCents: debt.principalCents, monthlyRateBps: debt.monthlyRateBps, count: debt.installmentCount, system: debt.amortization,
  }).map((row) => [row.number, row]))]));
}

export async function assertTitleNotDebtInstallment(tx: TenantScopedClient, companyId: string, groupId: string | null) {
  if (groupId && await tx.debt.findFirst({ where: { companyId, installmentGroupId: groupId }, select: { id: true } })) {
    throw new DebtInstallmentManagedError();
  }
}

/** Rateio gerencial proporcional, sobre o acumulado: não perde centavos a cada baixa parcial. */
export function remainingDebtInstallment(row: ScheduleRow, settledCents: bigint) {
  const zero = BigInt(0);
  const paid = settledCents < zero ? zero : settledCents > row.paymentCents ? row.paymentCents : settledCents;
  const amortizedCents = row.paymentCents > zero
    ? (row.amortizationCents * paid + row.paymentCents / BigInt(2)) / row.paymentCents
    : zero;
  const remainingPaymentCents = row.paymentCents - paid;
  const remainingPrincipalCents = row.amortizationCents - amortizedCents;
  return { amortizedCents, remainingPaymentCents, remainingPrincipalCents, remainingInterestCents: remainingPaymentCents - remainingPrincipalCents };
}
