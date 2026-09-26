import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { registerUser } from "../identity/register";
import { createCompany } from "../companies/create-company";
import { createFinancialAccount } from "../financial-accounts/create-account";
import { listFinancialAccountsWithBalance } from "../financial-accounts/account-balances";
import { createCategory } from "../categories/create-category";
import { createTitle } from "../titles/create-title";
import { registerSettlement } from "../titles/register-settlement";
import { createTransfer } from "../transfers/create-transfer";
import { reverseTransfer } from "../transfers/reverse-transfer";
import { CompanyAccessDeniedError, TransferSameAccountError } from "../errors";
import { rootClient, resetDatabase } from "./test-db";

function uniqueEmail(label: string) {
  return `${label}.${randomUUID()}@teste.ax.finance`;
}

async function setupCompanyWithTwoAccounts(label: string) {
  const user = await registerUser({
    email: uniqueEmail(label),
    name: `Usuária ${label}`,
    password: "senha-forte-123",
  });
  const company = await createCompany(user.id, { name: `Empresa ${label}` });
  const accountA = await createFinancialAccount(user.id, company.id, {
    name: "Conta A",
    type: "BANK",
    openingBalanceCents: 100_000,
    openingDate: "2026-01-01",
  });
  const accountB = await createFinancialAccount(user.id, company.id, {
    name: "Conta B",
    type: "BANK",
    openingBalanceCents: 0,
    openingDate: "2026-01-01",
  });
  const category = await createCategory(user.id, company.id, {
    name: "Serviços",
    nature: "OPERATING_REVENUE",
  });
  return { user, company, accountA, accountB, category };
}

function balanceOf(
  accounts: Awaited<ReturnType<typeof listFinancialAccountsWithBalance>>,
  accountId: string
) {
  return accounts.find((a) => a.id === accountId)!.currentBalanceCents;
}

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await rootClient.$disconnect();
});

describe("saldo atual por conta (Seção 8/18)", () => {
  it("transferência sem tarifa: A cai, B sobe, soma inalterada", async () => {
    const { user, company, accountA, accountB } = await setupCompanyWithTwoAccounts("transf-simples");

    await createTransfer(user.id, company.id, {
      fromAccountId: accountA.id,
      toAccountId: accountB.id,
      amountCents: 30_000,
      transferDate: "2026-02-01",
    });

    const accounts = await listFinancialAccountsWithBalance(user.id, company.id);
    expect(balanceOf(accounts, accountA.id)).toBe(70_000n);
    expect(balanceOf(accounts, accountB.id)).toBe(30_000n);
    expect(balanceOf(accounts, accountA.id) + balanceOf(accounts, accountB.id)).toBe(100_000n);
  });

  it("transferência com tarifa: consolidado cai exatamente a tarifa (Seção 30)", async () => {
    const { user, company, accountA, accountB } = await setupCompanyWithTwoAccounts("transf-tarifa");

    await createTransfer(user.id, company.id, {
      fromAccountId: accountA.id,
      toAccountId: accountB.id,
      amountCents: 30_000,
      feeCents: 500,
      transferDate: "2026-02-01",
    });

    const accounts = await listFinancialAccountsWithBalance(user.id, company.id);
    expect(balanceOf(accounts, accountA.id)).toBe(69_500n);
    expect(balanceOf(accounts, accountB.id)).toBe(30_000n);
    expect(balanceOf(accounts, accountA.id) + balanceOf(accounts, accountB.id)).toBe(99_500n);
  });

  it("rejeita transferência para a mesma conta", async () => {
    const { user, company, accountA } = await setupCompanyWithTwoAccounts("transf-mesma-conta");

    await expect(
      createTransfer(user.id, company.id, {
        fromAccountId: accountA.id,
        toAccountId: accountA.id,
        amountCents: 1_000,
        transferDate: "2026-02-01",
      })
    ).rejects.toBeInstanceOf(TransferSameAccountError);
  });

  it("isolamento: não transfere usando conta de outra empresa", async () => {
    const owner = await setupCompanyWithTwoAccounts("transf-owner");
    const outsider = await setupCompanyWithTwoAccounts("transf-outsider");

    await expect(
      createTransfer(outsider.user.id, outsider.company.id, {
        fromAccountId: outsider.accountA.id,
        toAccountId: owner.accountB.id,
        amountCents: 1_000,
        transferDate: "2026-02-01",
      })
    ).rejects.toThrow();

    const outsiderAccounts = await listFinancialAccountsWithBalance(outsider.user.id, outsider.company.id);
    expect(balanceOf(outsiderAccounts, outsider.accountA.id)).toBe(100_000n);
  });

  it("estorno de transferência devolve o saldo sem apagar o registro", async () => {
    const { user, company, accountA, accountB } = await setupCompanyWithTwoAccounts("transf-estorno");

    const transfer = await createTransfer(user.id, company.id, {
      fromAccountId: accountA.id,
      toAccountId: accountB.id,
      amountCents: 30_000,
      transferDate: "2026-02-01",
    });

    await reverseTransfer(user.id, company.id, transfer.id, { reason: "valor errado" });

    const accounts = await listFinancialAccountsWithBalance(user.id, company.id);
    expect(balanceOf(accounts, accountA.id)).toBe(100_000n);
    expect(balanceOf(accounts, accountB.id)).toBe(0n);

    const transfers = await (await import("../transfers/list-transfers")).listTransfers(user.id, company.id);
    expect(transfers).toHaveLength(1);
    expect(transfers[0]?.reversedAt).not.toBeNull();
  });

  it("baixa de entrada com taxa retida: saldo sobe principal menos taxa (exemplo da Seção 6)", async () => {
    const { user, company, accountA, category } = await setupCompanyWithTwoAccounts("baixa-entrada");

    const title = await createTitle(user.id, company.id, {
      type: "RECEIVABLE",
      description: "Título com taxa",
      categoryId: category.id,
      originalAmountCents: 100_000,
      competenceDate: "2026-01-01",
      dueDate: "2026-01-31",
    });

    await registerSettlement(user.id, company.id, title.id, {
      financialAccountId: accountA.id,
      principalAmountCents: 40_000,
      feesCents: 800,
      effectiveDate: "2026-01-15",
    });

    const accounts = await listFinancialAccountsWithBalance(user.id, company.id);
    // Saldo de abertura 100.000 + (40.000 recebidos − 800 de taxa)
    expect(balanceOf(accounts, accountA.id)).toBe(139_200n);
  });

  it("baixa de saída: saldo cai principal + juros + taxas", async () => {
    const { user, company, accountA, category } = await setupCompanyWithTwoAccounts("baixa-saida");

    const title = await createTitle(user.id, company.id, {
      type: "PAYABLE",
      description: "Conta a pagar",
      categoryId: category.id,
      originalAmountCents: 100_000,
      competenceDate: "2026-01-01",
      dueDate: "2026-01-31",
    });

    await registerSettlement(user.id, company.id, title.id, {
      financialAccountId: accountA.id,
      principalAmountCents: 50_000,
      interestPenaltyCents: 1_000,
      feesCents: 200,
      effectiveDate: "2026-01-15",
    });

    const accounts = await listFinancialAccountsWithBalance(user.id, company.id);
    // 100.000 − (50.000 + 1.000 + 200)
    expect(balanceOf(accounts, accountA.id)).toBe(48_800n);
  });
});
