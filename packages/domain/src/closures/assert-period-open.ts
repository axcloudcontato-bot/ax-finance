import type { TenantScopedClient } from "@ax-finance/db";
import { PeriodClosedError, PeriodClosureBusyError } from "../errors";

function yearMonthOf(date: Date): string {
  return date.toISOString().slice(0, 7);
}

/**
 * Protege a data financeira que a operação altera: competência para títulos,
 * data efetiva para baixas/estornos. Roda dentro da mesma transação da escrita.
 */
export async function assertPeriodOpen(tx: TenantScopedClient, companyId: string, date: Date) {
  // Verificações de período podem coexistir; fechar/reabrir aguarda as escritas em andamento.
  await lockPeriodClosure(tx, companyId, true);
  const period = yearMonthOf(date);
  const closure = await tx.periodClosure.findUnique({
    where: { companyId_period: { companyId, period } },
  });
  if (closure && closure.status === "CLOSED") {
    throw new PeriodClosedError(period);
  }
}

export async function lockPeriodClosure(tx: TenantScopedClient, companyId: string, shared = false) {
  const key = `financial-periods:${companyId}`;
  if (shared) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock_shared(hashtextextended(${key}, 0))`;
  } else {
    // Não enfileira uma trava exclusiva atrás de escritas que já seguram linhas:
    // isso bloquearia novas travas compartilhadas e poderia formar um deadlock.
    const deadline = Date.now() + 2500;
    while (Date.now() < deadline) {
      const [result] = await tx.$queryRaw<{ acquired: boolean }[]>`SELECT pg_try_advisory_xact_lock(hashtextextended(${key}, 0)) AS acquired`;
      if (result?.acquired) return;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new PeriodClosureBusyError();
  }
}
