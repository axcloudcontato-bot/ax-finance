import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { registerUser } from "../identity/register";
import { completeOnboarding } from "../companies/complete-onboarding";
import { listCompaniesForUser } from "../companies/list-companies";
import { listFinancialAccountsWithBalance } from "../financial-accounts/account-balances";
import { listCategories } from "../categories/list-categories";
import { rootClient, resetDatabase } from "./test-db";
import { getCompanySubscription } from "../subscriptions/subscriptions";

function uniqueEmail(label: string) {
  return `${label}.${randomUUID()}@teste.ax.finance`;
}

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await rootClient.$disconnect();
});

describe("onboarding completo (empresa + conta + categorias numa transação)", () => {
  it("plano Gestão Pessoal começa com categorias pessoais; Essencial, com as de empresa de serviços", async () => {
    const input = { accountName: "Conta", accountType: "BANK", openingBalanceCents: 0, openingDate: "2026-01-01" } as const;
    const personalUser = await registerUser({ email: uniqueEmail("pessoal"), name: "Pessoa", password: "senha-forte-123" });
    const personal = await completeOnboarding(personalUser.id, { ...input, companyName: "Minhas finanças", planCode: "PERSONAL" });
    const businessUser = await registerUser({ email: uniqueEmail("empresa"), name: "Empresa", password: "senha-forte-123" });
    const business = await completeOnboarding(businessUser.id, { ...input, companyName: "Minha empresa", planCode: "ESSENTIAL" });

    const personalNames = (await listCategories(personalUser.id, personal.company.id)).map((category) => category.name);
    expect(personalNames).toEqual(expect.arrayContaining(["Renda", "Salário", "Moradia", "Supermercado", "Reserva de emergência"]));
    expect(personalNames).not.toContain("Receita de serviços");

    const businessNames = (await listCategories(businessUser.id, business.company.id)).map((category) => category.name);
    expect(businessNames).toContain("Receita de serviços");
    expect(businessNames).not.toContain("Salário");

    // Renda precisa ser receita operacional: é a natureza que o seletor de "Nova entrada" aceita.
    const income = (await listCategories(personalUser.id, personal.company.id)).filter((category) => category.name === "Salário" || category.name === "Renda");
    expect(income.every((category) => category.nature === "OPERATING_REVENUE")).toBe(true);
  });

  it("cria empresa, conta e categorias padrão de uma vez", async () => {
    const user = await registerUser({
      email: uniqueEmail("onboard"),
      name: "Usuária Onboard",
      password: "senha-forte-123",
    });

    const { company, account } = await completeOnboarding(user.id, {
      companyName: "Empresa Onboard",
      accountName: "Conta principal",
      accountType: "BANK",
      openingBalanceCents: 50_000,
      openingDate: "2026-01-01",
    });

    expect(company.name).toBe("Empresa Onboard");
    expect(account.openingBalanceCents).toBe(50_000n);

    const companies = await listCompaniesForUser(user.id);
    expect(companies.map((c) => c.id)).toEqual([company.id]);

    const accounts = await listFinancialAccountsWithBalance(user.id, company.id);
    expect(accounts).toHaveLength(1);
    expect(accounts[0]?.currentBalanceCents).toBe(50_000n);

    const categories = await listCategories(user.id, company.id);
    expect(categories.length).toBeGreaterThan(10);
    const subscription = await getCompanySubscription(user.id, company.id);
    expect(subscription).toMatchObject({ status: "TRIAL", planCode: "ESSENTIAL" });
    expect(subscription?.trialEndsAt).toBeInstanceOf(Date);
  });

  it("entrada inválida não cria nada — validação roda antes de qualquer escrita", async () => {
    const user = await registerUser({
      email: uniqueEmail("onboard-invalido"),
      name: "Usuária Onboard Inválido",
      password: "senha-forte-123",
    });

    await expect(
      completeOnboarding(user.id, {
        companyName: "Empresa Que Não Deveria Existir",
        accountName: "",
        accountType: "BANK",
        openingBalanceCents: 0,
        openingDate: "2026-01-01",
      })
    ).rejects.toThrow();

    const companies = await listCompaniesForUser(user.id);
    expect(companies).toHaveLength(0);
  });
});
