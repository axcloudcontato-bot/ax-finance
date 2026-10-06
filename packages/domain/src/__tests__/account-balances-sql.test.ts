import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { withCompanyContext } from "@ax-finance/db";
import { registerUser } from "../identity/register";
import { createCompany } from "../companies/create-company";
import { createCategory } from "../categories/create-category";
import { createFinancialAccount } from "../financial-accounts/create-account";
import { computeAccountBalanceDeltas, listFinancialAccountsWithBalance } from "../financial-accounts/account-balances";
import { createBalanceAdjustment } from "../financial-accounts/create-balance-adjustment";
import { createTitle } from "../titles/create-title";
import { registerSettlement } from "../titles/register-settlement";
import { reverseSettlement } from "../titles/reverse-settlement";
import { registerSettlementRefund } from "../titles/settlement-refunds";
import { createTransfer } from "../transfers/create-transfer";
import { rootClient, resetDatabase } from "./test-db";

function uniqueEmail(label: string) {
  return `${label}.${randomUUID()}@teste.ax.finance`;
}

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await rootClient.$disconnect();
});

/**
 * O saldo é somado no banco (SQL agrupado por conta). Este teste junta todos os tipos de movimento,
 * itens estornados e a data limite, e confere o resultado contra a conta feita à mão.
 */
describe("saldo por conta somado no banco", () => {
  it("baixa, devolução, transferência com tarifa e ajuste; estornados e posteriores à data limite ficam de fora", async () => {
    const user = await registerUser({ email: uniqueEmail("saldo-sql"), name: "Usuária", password: "senha-forte-123" });
    const company = await createCompany(user.id, { name: "Empresa saldo" });
    const main = await createFinancialAccount(user.id, company.id, { name: "Principal", type: "BANK", openingBalanceCents: 100_000, openingDate: "2026-01-01" });
    const second = await createFinancialAccount(user.id, company.id, { name: "Reserva", type: "BANK", openingBalanceCents: 0, openingDate: "2026-01-01" });
    const revenue = await createCategory(user.id, company.id, { name: "Serviços", nature: "OPERATING_REVENUE" });
    const expense = await createCategory(user.id, company.id, { name: "Aluguel", nature: "EXPENSE" });
    const base = { competenceDate: "2026-09-01", dueDate: "2026-09-10" };

    const sale = await createTitle(user.id, company.id, { type: "RECEIVABLE", description: "Venda", categoryId: revenue.id, originalAmountCents: 50_000, ...base });
    const saleSettlement = await registerSettlement(user.id, company.id, sale.id, { financialAccountId: main.id, principalAmountCents: 50_000, interestPenaltyCents: 1_000, feesCents: 800, effectiveDate: "2026-09-05" });
    const rent = await createTitle(user.id, company.id, { type: "PAYABLE", description: "Aluguel", categoryId: expense.id, originalAmountCents: 30_000, ...base });
    await registerSettlement(user.id, company.id, rent.id, { financialAccountId: main.id, principalAmountCents: 30_000, interestPenaltyCents: 500, feesCents: 200, effectiveDate: "2026-09-06" });
    const reversedBill = await createTitle(user.id, company.id, { type: "PAYABLE", description: "Estornada", categoryId: expense.id, originalAmountCents: 9_000, ...base });
    const reversed = await registerSettlement(user.id, company.id, reversedBill.id, { financialAccountId: main.id, principalAmountCents: 9_000, effectiveDate: "2026-09-07" });
    await reverseSettlement(user.id, company.id, reversed.id, { reason: "engano" });

    await registerSettlementRefund(user.id, company.id, saleSettlement.id, { financialAccountId: main.id, amountCents: 4_000, effectiveDate: "2026-09-08", reason: "devolução parcial" });
    await createTransfer(user.id, company.id, { fromAccountId: main.id, toAccountId: second.id, amountCents: 20_000, feeCents: 150, transferDate: "2026-09-09" });
    await createBalanceAdjustment(user.id, company.id, { financialAccountId: second.id, targetBalanceCents: 21_000, reason: "conferência", effectiveDate: "2026-09-12" });
    const later = await createTitle(user.id, company.id, { type: "PAYABLE", description: "Depois", categoryId: expense.id, originalAmountCents: 7_000, competenceDate: "2026-10-01", dueDate: "2026-10-10" });
    await registerSettlement(user.id, company.id, later.id, { financialAccountId: main.id, principalAmountCents: 7_000, effectiveDate: "2026-10-15" });

    const balances = async () => Object.fromEntries((await listFinancialAccountsWithBalance(user.id, company.id)).map((account) => [account.name, Number(account.currentBalanceCents)]));
    // Principal: 100.000 + (50.000 + 1.000 − 800) − (30.000 + 500 + 200) − 4.000 (devolução) − (20.000 + 150) − 7.000
    // Reserva: 20.000 (transferência) + 1.000 (ajuste até 21.000)
    expect(await balances()).toEqual({
      Principal: 100_000 + 50_200 - 30_700 - 4_000 - 20_150 - 7_000,
      Reserva: 21_000,
    });

    // Com data limite em 10/09, ficam de fora o ajuste do dia 12 e a baixa de outubro.
    const asOf = await withCompanyContext(user.id, company.id, (tx) => computeAccountBalanceDeltas(tx, company.id, new Date("2026-09-10T00:00:00Z")));
    expect(Number(asOf.get(main.id))).toBe(50_200 - 30_700 - 4_000 - 20_150);
    expect(Number(asOf.get(second.id))).toBe(20_000);
  });
});
