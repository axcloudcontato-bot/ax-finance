import { z } from "zod";
import { withCompanyContext, type TenantScopedClient } from "@ax-finance/db";
import { assertActiveMembership } from "../companies/assert-membership";
import { assertCompanyPermission } from "../companies/permissions";
import { recordAuditEvent } from "../audit/record-audit-event";
import { assertPeriodOpen } from "../closures/assert-period-open";
import { computeAccountBalanceDeltas } from "../financial-accounts/account-balances";
import { OPERATIONAL_ACCOUNT } from "../financial-accounts/operational";
import { companyToday } from "../shared/today";
import { beginIdempotentOperation, completeIdempotentOperation, idempotencyKeySchema } from "../idempotency/operations";
import {
  FinancialAccountNotFoundError,
  IdempotencyResultUnavailableError,
  SavingsGoalArchivedError,
  SavingsGoalFutureDateError,
  SavingsGoalInUseError,
  SavingsGoalInsufficientBalanceError,
  SavingsGoalNotEmptyError,
  SavingsGoalNotFoundError,
} from "../errors";
import { SAVINGS_GOAL_COLORS, SAVINGS_GOAL_ICONS, computeSavingsGoalProgress } from "./progress";

const ZERO = BigInt(0);
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const asDate = (value: string) => new Date(`${value}T00:00:00Z`);
const toDateString = (value: Date) => value.toISOString().slice(0, 10);

const goalFields = {
  name: z.string().trim().min(1).max(80),
  targetAmountCents: z.number().int().positive(),
  targetDate: dateOnly.nullish(),
  color: z.enum(SAVINGS_GOAL_COLORS),
  icon: z.enum(SAVINGS_GOAL_ICONS),
  defaultSourceAccountId: z.string().uuid().nullish(),
};

export const createSavingsGoalInput = z.object({
  ...goalFields,
  /** Valor já guardado na criação (opcional): vira o primeiro "guardar" a partir de `initialSourceAccountId`. */
  initialAmountCents: z.number().int().min(0).default(0),
  initialSourceAccountId: z.string().uuid().nullish(),
  idempotencyKey: idempotencyKeySchema,
});

export const updateSavingsGoalInput = z.object(goalFields);

export const savingsGoalMoveInput = z.object({
  accountId: z.string().uuid(),
  amountCents: z.number().int().positive(),
  date: dateOnly,
  note: z.string().trim().max(200).optional(),
  idempotencyKey: idempotencyKeySchema,
});

type Goal = NonNullable<Awaited<ReturnType<TenantScopedClient["savingsGoal"]["findFirst"]>>>;

/** Trava a linha do cofrinho: dois resgates ao mesmo tempo não conseguem passar do saldo. */
async function lockGoal(tx: TenantScopedClient, companyId: string, goalId: string): Promise<Goal> {
  await tx.$queryRaw`SELECT "id" FROM "savings_goals" WHERE "id" = ${goalId} AND "company_id" = ${companyId} FOR UPDATE`;
  const goal = await tx.savingsGoal.findFirst({ where: { id: goalId, companyId } });
  if (!goal) throw new SavingsGoalNotFoundError();
  return goal;
}

async function goalBalance(tx: TenantScopedClient, companyId: string, financialAccountId: string): Promise<bigint> {
  const deltas = await computeAccountBalanceDeltas(tx, companyId);
  return deltas.get(financialAccountId) ?? ZERO;
}

async function assertSourceAccount(tx: TenantScopedClient, companyId: string, accountId: string) {
  const account = await tx.financialAccount.findFirst({ where: { id: accountId, companyId, status: "ACTIVE", ...OPERATIONAL_ACCOUNT } });
  if (!account) throw new FinancialAccountNotFoundError();
  return account;
}

/** Guardar (conta → cofrinho) ou resgatar (cofrinho → conta), dentro de uma transação já aberta. */
async function moveInTx(
  tx: TenantScopedClient,
  params: { userId: string; companyId: string; goal: Goal; direction: "DEPOSIT" | "WITHDRAW"; accountId: string; amountCents: number; date: string; note?: string },
) {
  const { userId, companyId, goal, direction, accountId, amountCents, date, note } = params;
  if (goal.status !== "ACTIVE") throw new SavingsGoalArchivedError();
  if (date > (await companyToday(tx, companyId))) throw new SavingsGoalFutureDateError();
  const account = await assertSourceAccount(tx, companyId, accountId);
  await assertPeriodOpen(tx, companyId, asDate(date));

  const before = await goalBalance(tx, companyId, goal.financialAccountId);
  const amount = BigInt(amountCents);
  if (direction === "WITHDRAW" && amount > before) throw new SavingsGoalInsufficientBalanceError();

  const transfer = await tx.transfer.create({
    data: {
      companyId,
      fromAccountId: direction === "DEPOSIT" ? account.id : goal.financialAccountId,
      toAccountId: direction === "DEPOSIT" ? goal.financialAccountId : account.id,
      amountCents: amount,
      feeCents: ZERO,
      transferDate: asDate(date),
      description: note || (direction === "DEPOSIT" ? `Guardado no cofrinho ${goal.name}` : `Resgatado do cofrinho ${goal.name}`),
    },
  });

  const after = direction === "DEPOSIT" ? before + amount : before - amount;
  if (direction === "DEPOSIT" && !goal.goalReachedAt && after >= goal.targetAmountCents) {
    await tx.savingsGoal.update({ where: { id: goal.id }, data: { goalReachedAt: new Date() } });
  }

  await recordAuditEvent(tx, {
    companyId,
    actorUserId: userId,
    eventType: direction === "DEPOSIT" ? "SAVINGS_GOAL_DEPOSIT" : "SAVINGS_GOAL_WITHDRAWAL",
    resourceType: "SavingsGoal",
    resourceId: goal.id,
    summary: `${direction === "DEPOSIT" ? "Guardado em" : "Resgatado de"} ${goal.name}`,
    metadata: { amountCents, accountId: account.id, transferId: transfer.id },
  });
  return { transfer, balanceCents: after };
}

export async function createSavingsGoal(userId: string, companyId: string, rawInput: unknown) {
  const data = createSavingsGoalInput.parse(rawInput);
  await assertCompanyPermission(userId, companyId, "FINANCE_WRITE");

  return withCompanyContext(userId, companyId, async (tx) => {
    const { idempotencyKey, ...request } = data;
    const idempotency = await beginIdempotentOperation(tx, { companyId, operation: "CREATE_SAVINGS_GOAL", key: idempotencyKey, request, resourceType: "SavingsGoal" });
    if (idempotency.kind === "replay") {
      const existing = await tx.savingsGoal.findFirst({ where: { id: idempotency.resourceId, companyId } });
      if (!existing) throw new IdempotencyResultUnavailableError();
      return existing;
    }

    if (data.defaultSourceAccountId) await assertSourceAccount(tx, companyId, data.defaultSourceAccountId);
    const today = await companyToday(tx, companyId);
    const account = await tx.financialAccount.create({
      data: {
        companyId,
        name: `Cofrinho: ${data.name}`,
        type: "SAVINGS_GOAL",
        openingBalanceCents: ZERO,
        openingDate: asDate(today),
        includedInAvailableTotal: false,
      },
    });
    const goal = await tx.savingsGoal.create({
      data: {
        companyId,
        financialAccountId: account.id,
        name: data.name,
        targetAmountCents: BigInt(data.targetAmountCents),
        targetDate: data.targetDate ? asDate(data.targetDate) : null,
        color: data.color,
        icon: data.icon,
        defaultSourceAccountId: data.defaultSourceAccountId ?? null,
        createdByUserId: userId,
      },
    });

    await recordAuditEvent(tx, {
      companyId,
      actorUserId: userId,
      eventType: "SAVINGS_GOAL_CREATED",
      resourceType: "SavingsGoal",
      resourceId: goal.id,
      summary: `Cofrinho ${goal.name} criado`,
      metadata: { targetAmountCents: data.targetAmountCents },
    });

    if (data.initialAmountCents > 0) {
      const sourceId = data.initialSourceAccountId ?? data.defaultSourceAccountId;
      if (!sourceId) throw new FinancialAccountNotFoundError();
      await moveInTx(tx, { userId, companyId, goal, direction: "DEPOSIT", accountId: sourceId, amountCents: data.initialAmountCents, date: today });
    }

    await completeIdempotentOperation(tx, idempotency, goal.id);
    return goal;
  });
}

export async function updateSavingsGoal(userId: string, companyId: string, goalId: string, rawInput: unknown) {
  const data = updateSavingsGoalInput.parse(rawInput);
  await assertCompanyPermission(userId, companyId, "FINANCE_WRITE");

  return withCompanyContext(userId, companyId, async (tx) => {
    const goal = await lockGoal(tx, companyId, goalId);
    if (data.defaultSourceAccountId) await assertSourceAccount(tx, companyId, data.defaultSourceAccountId);
    const target = BigInt(data.targetAmountCents);
    const balance = await goalBalance(tx, companyId, goal.financialAccountId);
    const updated = await tx.savingsGoal.update({
      where: { id: goal.id },
      data: {
        name: data.name,
        targetAmountCents: target,
        targetDate: data.targetDate ? asDate(data.targetDate) : null,
        color: data.color,
        icon: data.icon,
        defaultSourceAccountId: data.defaultSourceAccountId ?? null,
        // meta nova já coberta pelo saldo conta como atingida agora; meta maior volta a "em andamento"
        goalReachedAt: balance >= target ? (goal.goalReachedAt ?? new Date()) : null,
      },
    });
    if (goal.name !== data.name) {
      await tx.financialAccount.update({ where: { id: goal.financialAccountId }, data: { name: `Cofrinho: ${data.name}` } });
    }
    await recordAuditEvent(tx, {
      companyId,
      actorUserId: userId,
      eventType: "SAVINGS_GOAL_UPDATED",
      resourceType: "SavingsGoal",
      resourceId: goal.id,
      summary: `Cofrinho ${data.name} atualizado`,
      metadata: { targetAmountCents: data.targetAmountCents },
    });
    return updated;
  });
}

async function move(userId: string, companyId: string, goalId: string, direction: "DEPOSIT" | "WITHDRAW", rawInput: unknown) {
  const data = savingsGoalMoveInput.parse(rawInput);
  await assertCompanyPermission(userId, companyId, "FINANCE_WRITE");

  return withCompanyContext(userId, companyId, async (tx) => {
    const { idempotencyKey, ...request } = data;
    const idempotency = await beginIdempotentOperation(tx, {
      companyId,
      operation: direction === "DEPOSIT" ? "SAVINGS_GOAL_DEPOSIT" : "SAVINGS_GOAL_WITHDRAWAL",
      key: idempotencyKey,
      request: { goalId, ...request },
      resourceType: "Transfer",
    });
    if (idempotency.kind === "replay") {
      const existing = await tx.transfer.findFirst({ where: { id: idempotency.resourceId, companyId } });
      if (!existing) throw new IdempotencyResultUnavailableError();
      return { transfer: existing };
    }
    const goal = await lockGoal(tx, companyId, goalId);
    const result = await moveInTx(tx, { userId, companyId, goal, direction, ...request });
    await completeIdempotentOperation(tx, idempotency, result.transfer.id);
    return result;
  });
}

/** Guardar: tira da conta escolhida e põe no cofrinho. */
export function depositToSavingsGoal(userId: string, companyId: string, goalId: string, input: unknown) {
  return move(userId, companyId, goalId, "DEPOSIT", input);
}

/** Resgatar: tira do cofrinho (até o saldo dele) e devolve para a conta escolhida. */
export function withdrawFromSavingsGoal(userId: string, companyId: string, goalId: string, input: unknown) {
  return move(userId, companyId, goalId, "WITHDRAW", input);
}

/** Arquiva um cofrinho vazio. Com `withdrawToAccountId`, resgata o saldo todo para essa conta antes. */
export async function archiveSavingsGoal(userId: string, companyId: string, goalId: string, options: { withdrawToAccountId?: string } = {}) {
  await assertCompanyPermission(userId, companyId, "FINANCE_WRITE");
  return withCompanyContext(userId, companyId, async (tx) => {
    const goal = await lockGoal(tx, companyId, goalId);
    let balance = await goalBalance(tx, companyId, goal.financialAccountId);
    if (balance > ZERO && options.withdrawToAccountId && goal.status === "ACTIVE") {
      await moveInTx(tx, { userId, companyId, goal, direction: "WITHDRAW", accountId: options.withdrawToAccountId, amountCents: Number(balance), date: await companyToday(tx, companyId) });
      balance = ZERO;
    }
    if (balance !== ZERO) throw new SavingsGoalNotEmptyError();
    await tx.savingsGoal.update({ where: { id: goal.id }, data: { status: "ARCHIVED" } });
    await tx.financialAccount.update({ where: { id: goal.financialAccountId }, data: { status: "ARCHIVED" } });
    await recordAuditEvent(tx, { companyId, actorUserId: userId, eventType: "SAVINGS_GOAL_ARCHIVED", resourceType: "SavingsGoal", resourceId: goal.id, summary: `Cofrinho ${goal.name} arquivado` });
  });
}

export async function reactivateSavingsGoal(userId: string, companyId: string, goalId: string) {
  await assertCompanyPermission(userId, companyId, "FINANCE_WRITE");
  return withCompanyContext(userId, companyId, async (tx) => {
    const goal = await lockGoal(tx, companyId, goalId);
    await tx.savingsGoal.update({ where: { id: goal.id }, data: { status: "ACTIVE" } });
    await tx.financialAccount.update({ where: { id: goal.financialAccountId }, data: { status: "ACTIVE" } });
    await recordAuditEvent(tx, { companyId, actorUserId: userId, eventType: "SAVINGS_GOAL_REACTIVATED", resourceType: "SavingsGoal", resourceId: goal.id, summary: `Cofrinho ${goal.name} reativado` });
  });
}

/** Excluir só vale para cofrinho que nunca teve movimento (criado por engano); com histórico, arquive. */
export async function deleteSavingsGoal(userId: string, companyId: string, goalId: string) {
  await assertCompanyPermission(userId, companyId, "FINANCE_WRITE");
  return withCompanyContext(userId, companyId, async (tx) => {
    const goal = await lockGoal(tx, companyId, goalId);
    const moves = await tx.transfer.count({ where: { companyId, OR: [{ fromAccountId: goal.financialAccountId }, { toAccountId: goal.financialAccountId }] } });
    const adjustments = await tx.balanceAdjustment.count({ where: { companyId, financialAccountId: goal.financialAccountId } });
    if (moves > 0 || adjustments > 0) throw new SavingsGoalInUseError();
    await tx.savingsGoal.delete({ where: { id: goal.id } });
    await tx.financialAccount.delete({ where: { id: goal.financialAccountId } });
    await recordAuditEvent(tx, { companyId, actorUserId: userId, eventType: "SAVINGS_GOAL_DELETED", resourceType: "SavingsGoal", resourceId: goal.id, summary: `Cofrinho ${goal.name} excluído` });
  });
}

function withProgress<T extends Goal>(goal: T, balanceCents: bigint, today: string) {
  return {
    ...goal,
    balanceCents,
    progress: computeSavingsGoalProgress({
      balanceCents,
      targetCents: goal.targetAmountCents,
      targetDate: goal.targetDate ? toDateString(goal.targetDate) : null,
      startDate: toDateString(goal.createdAt),
      today,
    }),
  };
}

export async function listSavingsGoals(userId: string, companyId: string, options: { includeArchived?: boolean } = {}) {
  await assertActiveMembership(userId, companyId);
  return withCompanyContext(userId, companyId, async (tx) => {
    const [goals, deltas, today] = await Promise.all([
      tx.savingsGoal.findMany({
        where: { companyId, ...(options.includeArchived ? {} : { status: "ACTIVE" }) },
        include: { defaultSourceAccount: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      }),
      computeAccountBalanceDeltas(tx, companyId),
      companyToday(tx, companyId),
    ]);
    const items = goals.map((goal) => withProgress(goal, deltas.get(goal.financialAccountId) ?? ZERO, today));
    const active = items.filter((goal) => goal.status === "ACTIVE");
    return {
      today,
      goals: items,
      totals: {
        savedCents: active.reduce((sum, goal) => sum + goal.balanceCents, ZERO),
        targetCents: active.reduce((sum, goal) => sum + goal.targetAmountCents, ZERO),
        activeCount: active.length,
        reachedCount: active.filter((goal) => goal.progress.reached).length,
      },
    };
  });
}

export async function getSavingsGoal(userId: string, companyId: string, goalId: string) {
  await assertActiveMembership(userId, companyId);
  return withCompanyContext(userId, companyId, async (tx) => {
    const goal = await tx.savingsGoal.findFirst({
      where: { id: goalId, companyId },
      include: { defaultSourceAccount: { select: { id: true, name: true } } },
    });
    if (!goal) throw new SavingsGoalNotFoundError();
    const [deltas, today, transfers] = await Promise.all([
      computeAccountBalanceDeltas(tx, companyId),
      companyToday(tx, companyId),
      tx.transfer.findMany({
        where: { companyId, OR: [{ fromAccountId: goal.financialAccountId }, { toAccountId: goal.financialAccountId }] },
        include: { fromAccount: { select: { id: true, name: true } }, toAccount: { select: { id: true, name: true } } },
        orderBy: [{ transferDate: "desc" }, { createdAt: "desc" }],
        take: 200,
      }),
    ]);
    const moves = transfers.map((transfer) => {
      const deposit = transfer.toAccountId === goal.financialAccountId;
      return {
        id: transfer.id,
        kind: deposit ? ("DEPOSIT" as const) : ("WITHDRAW" as const),
        date: transfer.transferDate,
        amountCents: transfer.amountCents,
        account: deposit ? transfer.fromAccount : transfer.toAccount,
        description: transfer.description,
        reversedAt: transfer.reversedAt,
        reversalReason: transfer.reversalReason,
      };
    });
    return { ...withProgress(goal, deltas.get(goal.financialAccountId) ?? ZERO, today), today, moves };
  });
}

/**
 * Usado pelo estorno de transferência: estornar um "guardar" tira o dinheiro do cofrinho de volta,
 * então não pode deixar o cofrinho negativo (o valor já foi resgatado).
 */
export async function assertSavingsGoalCanReverseDeposit(tx: TenantScopedClient, companyId: string, transfer: { toAccountId: string; amountCents: bigint }) {
  const goal = await tx.savingsGoal.findFirst({ where: { companyId, financialAccountId: transfer.toAccountId } });
  if (!goal) return;
  await lockGoal(tx, companyId, goal.id);
  const balance = await goalBalance(tx, companyId, goal.financialAccountId);
  if (balance < transfer.amountCents) throw new SavingsGoalInsufficientBalanceError();
}
