import type { TenantScopedClient } from "@ax-finance/db";
import { PeriodClosedError } from "../errors";

function yearMonthOf(date: Date): string {
  return date.toISOString().slice(0, 7);
}

/**
 * Seção 18 regra 8: baixa/estorno cuja data efetiva cai num período fechado
 * são bloqueados. Recebe `tx` de fora — deve rodar dentro da mesma
 * transação da baixa/estorno que está validando (mesmo padrão de
 * `recordAuditEvent`).
 */
export async function assertPeriodOpen(tx: TenantScopedClient, companyId: string, date: Date) {
  const period = yearMonthOf(date);
  const closure = await tx.periodClosure.findUnique({
    where: { companyId_period: { companyId, period } },
  });
  if (closure && closure.status === "CLOSED") {
    throw new PeriodClosedError(period);
  }
}
