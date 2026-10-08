import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { registerUser } from "../identity/register";
import { createCompany } from "../companies/create-company";
import { createFinancialAccount } from "../financial-accounts/create-account";
import { listFinancialAccounts } from "../financial-accounts/list-accounts";
import { listFinancialAccountsWithBalance } from "../financial-accounts/account-balances";
import { createTransfer } from "../transfers/create-transfer";
import { reverseTransfer } from "../transfers/reverse-transfer";
import { getDashboardOverview } from "../reports/dashboard-overview";
import { todayInTimeZone } from "../shared/today";
import {
  archiveSavingsGoal,
  createSavingsGoal,
  deleteSavingsGoal,
  depositToSavingsGoal,
  getSavingsGoal,
  listSavingsGoals,
  reactivateSavingsGoal,
  updateSavingsGoal,
  withdrawFromSavingsGoal,
} from "../savings-goals/savings-goals";
import { computeSavingsGoalProgress, monthsUntil } from "../savings-goals/progress";
import {
  FinancialAccountNotFoundError,
  SavingsGoalArchivedError,
  SavingsGoalFutureDateError,
  SavingsGoalInUseError,
  SavingsGoalInsufficientBalanceError,
  SavingsGoalNotEmptyError,
  SavingsGoalNotFoundError,
} from "../errors";
import { rootClient, resetDatabase } from "./test-db";

const today = todayInTimeZone();

async function setup(label: string) {
  const user = await registerUser({ email: `${label}.${randomUUID()}@teste.ax.finance`, name: label, password: "senha-forte-123" });
  const company = await createCompany(user.id, { name: `Empresa ${label}` });
  const account = await createFinancialAccount(user.id, company.id, { name: "Conta principal", type: "BANK", openingBalanceCents: 100_000, openingDate: "2026-01-01" });
  return { user, company, account };
}

async function balanceOf(userId: string, companyId: string, accountId: string) {
  return (await listFinancialAccountsWithBalance(userId, companyId)).find((item) => item.id === accountId)!.currentBalanceCents;
}

const goalInput = (extra: Record<string, unknown> = {}) => ({ name: "Viagem", targetAmountCents: 50_000, color: "blue", icon: "plane", ...extra });

beforeEach(async () => resetDatabase());
afterAll(async () => rootClient.$disconnect());

describe("progresso do cofrinho", () => {
  it("calcula percentual, quanto falta, barra limitada a 100 e passa de 100% no número", () => {
    const half = computeSavingsGoalProgress({ balanceCents: 25_000n, targetCents: 50_000n, targetDate: null, startDate: "2026-01-01", today: "2026-10-09" });
    expect(half).toMatchObject({ percent: 50, barPercent: 50, remainingCents: 25_000n, reached: false, pace: "NO_DEADLINE", monthlySuggestionCents: null });

    const over = computeSavingsGoalProgress({ balanceCents: 52_000n, targetCents: 50_000n, targetDate: "2026-12-31", startDate: "2026-01-01", today: "2026-10-09" });
    expect(over).toMatchObject({ percent: 104, barPercent: 100, remainingCents: 0n, reached: true, pace: "REACHED", monthlySuggestionCents: null });
  });

  it("sugere o valor mensal até o prazo e mostra se está no ritmo", () => {
    expect(monthsUntil("2026-10-09", "2026-12-31")).toBe(3);
    expect(monthsUntil("2026-10-09", "2026-11-05")).toBe(1);
    expect(monthsUntil("2026-10-09", "2026-10-01")).toBe(0);

    const behind = computeSavingsGoalProgress({ balanceCents: 10_000n, targetCents: 100_000n, targetDate: "2026-12-31", startDate: "2026-01-01", today: "2026-10-09" });
    expect(behind.monthlySuggestionCents).toBe(30_000n); // faltam 90.000 em 3 meses
    expect(behind.pace).toBe("BEHIND");

    const onTrack = computeSavingsGoalProgress({ balanceCents: 80_000n, targetCents: 100_000n, targetDate: "2026-12-31", startDate: "2026-01-01", today: "2026-10-09" });
    expect(onTrack.pace).toBe("ON_TRACK");

    const overdue = computeSavingsGoalProgress({ balanceCents: 10_000n, targetCents: 100_000n, targetDate: "2026-09-30", startDate: "2026-01-01", today: "2026-10-09" });
    expect(overdue).toMatchObject({ pace: "OVERDUE", monthsLeft: 0, monthlySuggestionCents: null });
  });
});

describe("cofrinhos", () => {
  it("guardar tira da conta e enche o cofrinho; resgatar devolve, sem passar do saldo", async () => {
    const { user, company, account } = await setup("cofre-basico");
    const goal = await createSavingsGoal(user.id, company.id, goalInput({ defaultSourceAccountId: account.id }));

    await depositToSavingsGoal(user.id, company.id, goal.id, { accountId: account.id, amountCents: 20_000, date: today });
    await depositToSavingsGoal(user.id, company.id, goal.id, { accountId: account.id, amountCents: 5_000, date: today });
    expect(await balanceOf(user.id, company.id, account.id)).toBe(75_000n);

    const detail = await getSavingsGoal(user.id, company.id, goal.id);
    expect(detail.balanceCents).toBe(25_000n);
    expect(detail.progress.percent).toBe(50);
    expect(detail.moves.map((move) => move.kind)).toEqual(["DEPOSIT", "DEPOSIT"]);

    await expect(withdrawFromSavingsGoal(user.id, company.id, goal.id, { accountId: account.id, amountCents: 25_001, date: today }))
      .rejects.toBeInstanceOf(SavingsGoalInsufficientBalanceError);
    await withdrawFromSavingsGoal(user.id, company.id, goal.id, { accountId: account.id, amountCents: 10_000, date: today });
    expect(await balanceOf(user.id, company.id, account.id)).toBe(85_000n);
    expect((await getSavingsGoal(user.id, company.id, goal.id)).balanceCents).toBe(15_000n);
  });

  it("o valor inicial vira o primeiro guardar e a meta atingida fica registrada", async () => {
    const { user, company, account } = await setup("cofre-inicial");
    const goal = await createSavingsGoal(user.id, company.id, goalInput({ initialAmountCents: 50_000, initialSourceAccountId: account.id }));
    const detail = await getSavingsGoal(user.id, company.id, goal.id);
    expect(detail.balanceCents).toBe(50_000n);
    expect(detail.progress.reached).toBe(true);
    expect(detail.goalReachedAt).not.toBeNull();

    // meta maior volta a "em andamento"
    await updateSavingsGoal(user.id, company.id, goal.id, goalInput({ targetAmountCents: 80_000, name: "Viagem longa" }));
    const updated = await getSavingsGoal(user.id, company.id, goal.id);
    expect(updated.goalReachedAt).toBeNull();
    expect(updated.progress.percent).toBe(62.5);
  });

  it("não mexe no saldo disponível de forma errada nem aparece como conta comum", async () => {
    const { user, company, account } = await setup("cofre-disponivel");
    const goal = await createSavingsGoal(user.id, company.id, goalInput());
    await depositToSavingsGoal(user.id, company.id, goal.id, { accountId: account.id, amountCents: 30_000, date: today });

    const accounts = await listFinancialAccounts(user.id, company.id);
    expect(accounts.map((item) => item.type)).toEqual(["BANK"]);
    const overview = await getDashboardOverview(user.id, company.id, { from: today, to: today, today });
    expect(overview.availableBalanceCents).toBe(70_000n);
    expect(overview.accounts).toHaveLength(1);

    // a conta interna do cofrinho não serve para transferência comum
    await expect(createTransfer(user.id, company.id, { fromAccountId: goal.financialAccountId, toAccountId: account.id, amountCents: 100, transferDate: today }))
      .rejects.toBeInstanceOf(FinancialAccountNotFoundError);
  });

  it("estornar um guardar devolve o dinheiro, mas não se ele já foi resgatado", async () => {
    const { user, company, account } = await setup("cofre-estorno");
    const goal = await createSavingsGoal(user.id, company.id, goalInput());
    const first = await depositToSavingsGoal(user.id, company.id, goal.id, { accountId: account.id, amountCents: 20_000, date: today });
    const second = await depositToSavingsGoal(user.id, company.id, goal.id, { accountId: account.id, amountCents: 10_000, date: today });
    await withdrawFromSavingsGoal(user.id, company.id, goal.id, { accountId: account.id, amountCents: 15_000, date: today });

    await expect(reverseTransfer(user.id, company.id, first.transfer.id, { reason: "engano" })).rejects.toBeInstanceOf(SavingsGoalInsufficientBalanceError);
    await reverseTransfer(user.id, company.id, second.transfer.id, { reason: "engano" });
    expect((await getSavingsGoal(user.id, company.id, goal.id)).balanceCents).toBe(5_000n);
    expect(await balanceOf(user.id, company.id, account.id)).toBe(95_000n);
  });

  it("não aceita data futura nem cofrinho arquivado", async () => {
    const { user, company, account } = await setup("cofre-regras");
    const goal = await createSavingsGoal(user.id, company.id, goalInput());
    await expect(depositToSavingsGoal(user.id, company.id, goal.id, { accountId: account.id, amountCents: 100, date: "2999-01-01" }))
      .rejects.toBeInstanceOf(SavingsGoalFutureDateError);
    await archiveSavingsGoal(user.id, company.id, goal.id);
    await expect(depositToSavingsGoal(user.id, company.id, goal.id, { accountId: account.id, amountCents: 100, date: today }))
      .rejects.toBeInstanceOf(SavingsGoalArchivedError);
    await reactivateSavingsGoal(user.id, company.id, goal.id);
    await expect(depositToSavingsGoal(user.id, company.id, goal.id, { accountId: account.id, amountCents: 100, date: today })).resolves.toBeTruthy();
  });

  it("arquivar exige saldo zero ou resgata tudo antes; excluir só sem movimento", async () => {
    const { user, company, account } = await setup("cofre-arquivar");
    const goal = await createSavingsGoal(user.id, company.id, goalInput());
    await depositToSavingsGoal(user.id, company.id, goal.id, { accountId: account.id, amountCents: 12_345, date: today });

    await expect(archiveSavingsGoal(user.id, company.id, goal.id)).rejects.toBeInstanceOf(SavingsGoalNotEmptyError);
    await expect(deleteSavingsGoal(user.id, company.id, goal.id)).rejects.toBeInstanceOf(SavingsGoalInUseError);
    await archiveSavingsGoal(user.id, company.id, goal.id, { withdrawToAccountId: account.id });
    expect(await balanceOf(user.id, company.id, account.id)).toBe(100_000n);
    expect((await listSavingsGoals(user.id, company.id)).goals).toHaveLength(0);
    expect((await listSavingsGoals(user.id, company.id, { includeArchived: true })).goals[0]?.status).toBe("ARCHIVED");

    const mistake = await createSavingsGoal(user.id, company.id, goalInput({ name: "Errado" }));
    await deleteSavingsGoal(user.id, company.id, mistake.id);
    await expect(getSavingsGoal(user.id, company.id, mistake.id)).rejects.toBeInstanceOf(SavingsGoalNotFoundError);
  });

  it("mesma chave de envio não guarda duas vezes e totais somam só os ativos", async () => {
    const { user, company, account } = await setup("cofre-idem");
    const goal = await createSavingsGoal(user.id, company.id, goalInput());
    const other = await createSavingsGoal(user.id, company.id, goalInput({ name: "Reserva", targetAmountCents: 10_000, icon: "shield", color: "green" }));
    const key = randomUUID();
    await depositToSavingsGoal(user.id, company.id, goal.id, { accountId: account.id, amountCents: 7_000, date: today, idempotencyKey: key });
    await depositToSavingsGoal(user.id, company.id, goal.id, { accountId: account.id, amountCents: 7_000, date: today, idempotencyKey: key });
    await depositToSavingsGoal(user.id, company.id, other.id, { accountId: account.id, amountCents: 10_000, date: today });

    const list = await listSavingsGoals(user.id, company.id);
    expect(list.totals).toMatchObject({ savedCents: 17_000n, targetCents: 60_000n, activeCount: 2, reachedCount: 1 });
  });

  it("uma empresa não enxerga nem movimenta o cofrinho de outra", async () => {
    const first = await setup("cofre-a");
    const second = await setup("cofre-b");
    const goal = await createSavingsGoal(first.user.id, first.company.id, goalInput());
    await expect(getSavingsGoal(second.user.id, second.company.id, goal.id)).rejects.toBeInstanceOf(SavingsGoalNotFoundError);
    await expect(depositToSavingsGoal(second.user.id, second.company.id, goal.id, { accountId: second.account.id, amountCents: 100, date: today }))
      .rejects.toBeInstanceOf(SavingsGoalNotFoundError);
    // conta de outra empresa como origem
    await expect(depositToSavingsGoal(first.user.id, first.company.id, goal.id, { accountId: second.account.id, amountCents: 100, date: today }))
      .rejects.toBeInstanceOf(FinancialAccountNotFoundError);
  });
});
