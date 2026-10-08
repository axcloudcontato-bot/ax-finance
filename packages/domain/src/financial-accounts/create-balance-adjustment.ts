import { z } from "zod";
import { withCompanyContext } from "@ax-finance/db";
import { assertCompanyPermission } from "../companies/permissions";
import { assertPeriodOpen } from "../closures/assert-period-open";
import { recordAuditEvent } from "../audit/record-audit-event";
import { BalanceAdjustmentNotNeededError, FinancialAccountNotFoundError, IdempotencyResultUnavailableError } from "../errors";
import { computeAccountBalanceDeltas } from "./account-balances";
import { beginIdempotentOperation, completeIdempotentOperation, idempotencyKeySchema } from "../idempotency/operations";
import { OPERATIONAL_ACCOUNT } from "./operational";

export const createBalanceAdjustmentInput = z.object({
  financialAccountId: z.string().uuid(),
  targetBalanceCents: z.number().int(),
  reason: z.string().trim().min(1).max(500),
  effectiveDate: z.coerce.date(),
  idempotencyKey: idempotencyKeySchema,
});

/**
 * Corrige o saldo de uma conta pra um valor real observado (ex.: extrato do
 * banco) — o usuário informa o saldo ALVO, não o delta; o delta
 * (targetBalanceCents − saldo atual calculado) é o que fica gravado, porque
 * é ele que entra na soma de `computeAccountBalanceDeltas` dali pra frente
 * (o saldo "real" em si nunca é armazenado, só reconstruído a cada leitura,
 * mesma regra 11 de todo o resto do saldo).
 */
export async function createBalanceAdjustment(userId: string, companyId: string, input: unknown) {
  const data = createBalanceAdjustmentInput.parse(input);
  await assertCompanyPermission(userId, companyId, "FINANCE_WRITE");

  return withCompanyContext(userId, companyId, async (tx) => {
    const { idempotencyKey, ...request } = data;
    const idempotency = await beginIdempotentOperation(tx, {
      companyId,
      operation: "CREATE_BALANCE_ADJUSTMENT",
      key: idempotencyKey,
      request,
      resourceType: "BalanceAdjustment",
    });
    if (idempotency.kind === "replay") {
      const existing = await tx.balanceAdjustment.findFirst({
        where: { id: idempotency.resourceId, companyId },
      });
      if (!existing) throw new IdempotencyResultUnavailableError();
      return existing;
    }

    const account = await tx.financialAccount.findFirst({
      where: { id: data.financialAccountId, companyId, status: "ACTIVE", ...OPERATIONAL_ACCOUNT },
    });
    if (!account) {
      throw new FinancialAccountNotFoundError();
    }

    await assertPeriodOpen(tx, companyId, data.effectiveDate);

    const deltas = await computeAccountBalanceDeltas(tx, companyId);
    const currentBalanceCents = account.openingBalanceCents + (deltas.get(account.id) ?? BigInt(0));
    const amountCents = BigInt(data.targetBalanceCents) - currentBalanceCents;

    if (amountCents === BigInt(0)) {
      throw new BalanceAdjustmentNotNeededError();
    }

    const adjustment = await tx.balanceAdjustment.create({
      data: {
        companyId,
        financialAccountId: data.financialAccountId,
        amountCents,
        reason: data.reason,
        effectiveDate: data.effectiveDate,
        createdByUserId: userId,
      },
    });

    await recordAuditEvent(tx, {
      companyId,
      actorUserId: userId,
      eventType: "BALANCE_ADJUSTMENT_CREATED",
      resourceType: "FinancialAccount",
      resourceId: data.financialAccountId,
      summary: data.reason,
      metadata: {
        amountCents: amountCents.toString(),
        targetBalanceCents: data.targetBalanceCents,
        previousBalanceCents: currentBalanceCents.toString(),
      },
    });

    await completeIdempotentOperation(tx, idempotency, adjustment.id);
    return adjustment;
  });
}
