import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { registerUser } from "../identity/register";
import { createCompany } from "../companies/create-company";
import { createFinancialAccount } from "../financial-accounts/create-account";
import { createCategory } from "../categories/create-category";
import { createTitle } from "../titles/create-title";
import { registerSettlement } from "../titles/register-settlement";
import { getFinancialCalendar } from "../reports/financial-calendar";
import { todayInTimeZone } from "../shared/today";
import { rootClient, resetDatabase } from "./test-db";

const today = todayInTimeZone();
const shift = (days: number) => new Date(Date.parse(`${today}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

beforeEach(async () => resetDatabase());
afterAll(async () => rootClient.$disconnect());

describe("calendário financeiro", () => {
  it("mostra o que vence por dia, o realizado e o saldo previsto a partir de hoje", async () => {
    const user = await registerUser({ email: `cal.${randomUUID()}@teste.ax.finance`, name: "Agenda", password: "senha-forte-123" });
    const company = await createCompany(user.id, { name: "Empresa Agenda" });
    const account = await createFinancialAccount(user.id, company.id, { name: "Banco", type: "BANK", openingBalanceCents: 100_000, openingDate: "2026-01-01" });
    const revenue = await createCategory(user.id, company.id, { name: "Vendas", nature: "OPERATING_REVENUE" });
    const expense = await createCategory(user.id, company.id, { name: "Custos", nature: "EXPENSE" });

    const inTwoDays = shift(2);
    const month = inTwoDays.slice(0, 7);
    await createTitle(user.id, company.id, { type: "PAYABLE", description: "Vencida", categoryId: expense.id, originalAmountCents: 10_000, competenceDate: shift(-40), dueDate: shift(-40) });
    await createTitle(user.id, company.id, { type: "RECEIVABLE", description: "Cliente A", categoryId: revenue.id, originalAmountCents: 30_000, competenceDate: inTwoDays, dueDate: inTwoDays });
    const rent = await createTitle(user.id, company.id, { type: "PAYABLE", description: "Aluguel", categoryId: expense.id, originalAmountCents: 50_000, competenceDate: inTwoDays, dueDate: inTwoDays });
    await registerSettlement(user.id, company.id, rent.id, { financialAccountId: account.id, principalAmountCents: 20_000, effectiveDate: today });

    const calendar = await getFinancialCalendar(user.id, company.id, { month });
    // saldo de hoje: 100.000 − 20.000 pagos
    expect(calendar.availableTodayCents).toBe(80_000n);
    expect(calendar.overdue).toMatchObject({ count: 1, payableCents: 10_000n });

    const due = calendar.days.find((day) => day.date === inTwoDays)!;
    expect(due.receivableCents).toBe(30_000n);
    expect(due.payableCents).toBe(30_000n); // 50.000 − 20.000 já pagos
    expect(due.items.map((item) => item.description).sort()).toEqual(["Aluguel", "Cliente A"]);
    // 80.000 − 10.000 vencido (entra hoje) + 30.000 − 30.000
    expect(due.projectedBalanceCents).toBe(70_000n);

    if (today.slice(0, 7) === month) {
      const todayCell = calendar.days.find((day) => day.date === today)!;
      expect(todayCell.paidCents).toBe(20_000n);
      expect(todayCell.projectedBalanceCents).toBe(70_000n);
      const yesterday = calendar.days.find((day) => day.date === shift(-1));
      if (yesterday) expect(yesterday.projectedBalanceCents).toBeNull();
    }
  });

  it("mês que já passou não tem projeção", async () => {
    const user = await registerUser({ email: `cal2.${randomUUID()}@teste.ax.finance`, name: "Agenda", password: "senha-forte-123" });
    const company = await createCompany(user.id, { name: "Empresa Agenda 2" });
    const calendar = await getFinancialCalendar(user.id, company.id, { month: "2020-01" });
    expect(calendar.past).toBe(true);
    expect(calendar.days).toHaveLength(31);
    expect(calendar.days.every((day) => day.projectedBalanceCents === null)).toBe(true);
  });
});
