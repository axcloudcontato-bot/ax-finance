import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { registerUser } from "../identity/register";
import { createCompany } from "../companies/create-company";
import { createFinancialAccount } from "../financial-accounts/create-account";
import { createCategory } from "../categories/create-category";
import { registerSettlement } from "../titles/register-settlement";
import { createSavingsGoal, depositToSavingsGoal } from "../savings-goals/savings-goals";
import { amortizationSchedule, balanceAfter } from "../wealth/amortization";
import { createAsset, createDebt, deleteAsset, deleteDebt, getDebt, getNetWorth, listDebts, setDebtArchived, updateAsset } from "../wealth/wealth";
import { todayInTimeZone } from "../shared/today";
import { DebtHasPaymentsError, DebtNotFoundError } from "../errors";
import { rootClient, resetDatabase } from "./test-db";

const today = todayInTimeZone();
beforeEach(async () => resetDatabase());
afterAll(async () => rootClient.$disconnect());

async function setup(label: string) {
  const user = await registerUser({ email: `${label}.${randomUUID()}@teste.ax.finance`, name: label, password: "senha-forte-123" });
  const company = await createCompany(user.id, { name: `Casa ${label}` });
  const account = await createFinancialAccount(user.id, company.id, { name: "Conta", type: "BANK", openingBalanceCents: 1_000_000, openingDate: "2026-01-01" });
  const financing = await createCategory(user.id, company.id, { name: "Financiamentos", nature: "FINANCING" });
  return { user, company, account, financing };
}

describe("tabela de amortização", () => {
  it("Price: parcela fixa, juros caindo e saldo zerado no fim", () => {
    const rows = amortizationSchedule({ principalCents: 1_000_000n, monthlyRateBps: 100, count: 12, system: "PRICE" });
    expect(rows).toHaveLength(12);
    expect(rows[0]).toMatchObject({ paymentCents: 88_849n, interestCents: 10_000n, amortizationCents: 78_849n });
    expect(rows.slice(0, 11).every((row) => row.paymentCents === 88_849n)).toBe(true);
    expect(rows[11]!.balanceCents).toBe(0n);
    expect(rows.reduce((sum, row) => sum + row.amortizationCents, 0n)).toBe(1_000_000n);
  });

  it("SAC: amortização fixa e parcela caindo; sem juros vira divisão simples", () => {
    const sac = amortizationSchedule({ principalCents: 1_200_000n, monthlyRateBps: 100, count: 12, system: "SAC" });
    expect(sac[0]).toMatchObject({ amortizationCents: 100_000n, interestCents: 12_000n, paymentCents: 112_000n });
    expect(sac[11]).toMatchObject({ amortizationCents: 100_000n, interestCents: 1_000n, balanceCents: 0n });
    const flat = amortizationSchedule({ principalCents: 100_000n, monthlyRateBps: 0, count: 3, system: "PRICE" });
    expect(flat.map((row) => row.paymentCents)).toEqual([33_333n, 33_333n, 33_334n]);
    expect(balanceAfter(flat, 100_000n, 0)).toBe(100_000n);
    expect(balanceAfter(flat, 100_000n, 2)).toBe(33_334n);
  });
});

describe("dívidas e patrimônio", () => {
  it("lança as parcelas que faltam como saídas e o saldo devedor acompanha as pagas", async () => {
    const { user, company, account, financing } = await setup("divida");
    const debt = await createDebt(user.id, company.id, {
      name: "Financiamento do carro", lender: "Banco X", principalCents: 1_000_000, monthlyRateBps: 100, installmentCount: 12,
      paidBeforeCount: 2, firstDueDate: "2026-08-10", amortization: "PRICE", categoryId: financing.id, expectedAccountId: account.id,
    });
    const titles = await rootClient.title.findMany({ where: { companyId: company.id, installmentGroupId: debt.installmentGroupId }, orderBy: { installmentNumber: "asc" } });
    expect(titles).toHaveLength(10);
    expect(titles[0]).toMatchObject({ type: "PAYABLE", installmentNumber: 3, installmentCount: 12, originalAmountCents: 88_849n, description: "Financiamento do carro — parcela 3/12" });
    expect(titles[0]!.dueDate.toISOString().slice(0, 10)).toBe("2026-10-10");

    let view = await getDebt(user.id, company.id, debt.id);
    const schedule = amortizationSchedule({ principalCents: 1_000_000n, monthlyRateBps: 100, count: 12, system: "PRICE" });
    expect(view.paidCount).toBe(2);
    expect(view.balanceCents).toBe(schedule[1]!.balanceCents);
    expect(view.nextInstallment).toMatchObject({ number: 3, amountCents: 88_849n });

    await registerSettlement(user.id, company.id, titles[0]!.id, { financialAccountId: account.id, principalAmountCents: 88_849, effectiveDate: today });
    view = await getDebt(user.id, company.id, debt.id);
    expect(view.paidCount).toBe(3);
    expect(view.balanceCents).toBe(schedule[2]!.balanceCents);
    expect(view.rows[2]!.state).toBe("PAID");

    await expect(deleteDebt(user.id, company.id, debt.id)).rejects.toBeInstanceOf(DebtHasPaymentsError);
    await setDebtArchived(user.id, company.id, debt.id, true);
    expect((await listDebts(user.id, company.id)).debts).toHaveLength(0);
  });

  it("excluir sem pagamento tira a dívida e as parcelas em aberto", async () => {
    const { user, company, financing } = await setup("divida-excluir");
    const debt = await createDebt(user.id, company.id, { name: "Empréstimo", principalCents: 300_000, monthlyRateBps: 250, installmentCount: 6, firstDueDate: "2026-11-05", amortization: "SAC", categoryId: financing.id });
    await deleteDebt(user.id, company.id, debt.id);
    expect(await rootClient.title.count({ where: { installmentGroupId: debt.installmentGroupId, deletedAt: null } })).toBe(0);
    await expect(getDebt(user.id, company.id, debt.id)).rejects.toBeInstanceOf(DebtNotFoundError);
  });

  it("patrimônio = contas + cofrinhos + bens − dívidas", async () => {
    const { user, company, account, financing } = await setup("patrimonio");
    const goal = await createSavingsGoal(user.id, company.id, { name: "Reserva", targetAmountCents: 500_000, color: "green", icon: "shield" });
    await depositToSavingsGoal(user.id, company.id, goal.id, { accountId: account.id, amountCents: 200_000, date: today });
    const car = await createAsset(user.id, company.id, { name: "Carro", kind: "VEHICLE", valueCents: 4_500_000, valuedAt: today });
    await createAsset(user.id, company.id, { name: "Tesouro Selic", kind: "INVESTMENT", valueCents: 1_000_000, valuedAt: today });
    await updateAsset(user.id, company.id, car.id, { name: "Carro", kind: "VEHICLE", valueCents: 4_000_000, valuedAt: today });
    await createDebt(user.id, company.id, { name: "Financiamento", principalCents: 1_000_000, monthlyRateBps: 100, installmentCount: 12, firstDueDate: "2026-12-10", categoryId: financing.id });

    const worth = await getNetWorth(user.id, company.id);
    expect(worth.accountsCents).toBe(800_000n);
    expect(worth.savingsCents).toBe(200_000n);
    expect(worth.assetsCents).toBe(5_000_000n);
    expect(worth.debtsCents).toBe(1_000_000n);
    expect(worth.netWorthCents).toBe(800_000n + 200_000n + 5_000_000n - 1_000_000n);

    await deleteAsset(user.id, company.id, car.id);
    expect((await getNetWorth(user.id, company.id)).assetsCents).toBe(1_000_000n);
  });
});
