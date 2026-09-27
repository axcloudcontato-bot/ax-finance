import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { withCompanyContext } from "@ax-finance/db";
import { registerUser } from "../identity/register";
import { createCompany } from "../companies/create-company";
import { listCompaniesForUser } from "../companies/list-companies";
import { assertActiveMembership } from "../companies/assert-membership";
import { createFinancialAccount } from "../financial-accounts/create-account";
import { listFinancialAccounts } from "../financial-accounts/list-accounts";
import { CompanyAccessDeniedError } from "../errors";
import { createCategory } from "../categories/create-category";
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

describe("isolamento entre empresas (FIN-001)", () => {
  it("usuário sem membership não vê, não acessa e não lista dados de outra empresa", async () => {
    const userA = await registerUser({
      email: uniqueEmail("a"),
      name: "Usuária A",
      password: "senha-forte-123",
    });
    const userB = await registerUser({
      email: uniqueEmail("b"),
      name: "Usuário B",
      password: "senha-forte-456",
    });

    const companyA = await createCompany(userA.id, { name: "Empresa A" });
    const companyB = await createCompany(userB.id, { name: "Empresa B" });

    await createFinancialAccount(userA.id, companyA.id, {
      name: "Conta da empresa A",
      type: "BANK",
      openingBalanceCents: 10_000,
      openingDate: "2026-01-01",
    });

    // Listagem: cada um só vê a própria empresa.
    const companiesForA = await listCompaniesForUser(userA.id);
    const companiesForB = await listCompaniesForUser(userB.id);
    expect(companiesForA.map((c) => c.id)).toEqual([companyA.id]);
    expect(companiesForB.map((c) => c.id)).toEqual([companyB.id]);

    // Acesso direto por id: B tentando a empresa de A é negado, sem
    // distinguir "não existe" de "existe mas não é seu" (mesma exceção).
    await expect(assertActiveMembership(userB.id, companyA.id)).rejects.toBeInstanceOf(
      CompanyAccessDeniedError
    );
    await expect(assertActiveMembership(userB.id, randomUUID())).rejects.toBeInstanceOf(
      CompanyAccessDeniedError
    );

    // Camada de aplicação: B não lista contas da empresa A mesmo colocando o
    // id de A "na URL" (simulado aqui passando companyA.id diretamente).
    await expect(listFinancialAccounts(userB.id, companyA.id)).rejects.toBeInstanceOf(
      CompanyAccessDeniedError
    );

    // Defesa em profundidade: mesmo pulando a checagem de aplicação e indo
    // direto no banco com o contexto de B "forçado" para a empresa de A, a
    // política de RLS de financial_accounts (que confere membership
    // ativa por conta própria, não só o company_id do contexto) ainda
    // bloqueia a leitura.
    const leaked = await withCompanyContext(userB.id, companyA.id, (tx) =>
      tx.financialAccount.findMany({ where: { companyId: companyA.id } })
    );
    expect(leaked).toEqual([]);

    // E também bloqueia escrita: B não consegue criar uma conta em nome da
    // empresa de A mesmo com o contexto forçado.
    await expect(
      withCompanyContext(userB.id, companyA.id, (tx) =>
        tx.financialAccount.create({
          data: {
            companyId: companyA.id,
            name: "Conta forjada",
            type: "BANK",
            openingBalanceCents: 999n,
            openingDate: new Date(),
          },
        })
      )
    ).rejects.toThrow();
  });

  it("chaves compostas rejeitam referências cruzadas mesmo usando o cliente root", async () => {
    const userA = await registerUser({ email: uniqueEmail("fk-a"), name: "A", password: "senha-forte-123" });
    const userB = await registerUser({ email: uniqueEmail("fk-b"), name: "B", password: "senha-forte-456" });
    const companyA = await createCompany(userA.id, { name: "Empresa FK A" });
    const companyB = await createCompany(userB.id, { name: "Empresa FK B" });
    const categoryB = await createCategory(userB.id, companyB.id, { name: "Categoria B", nature: "OPERATING_REVENUE" });

    await expect(rootClient.title.create({
      data: {
        companyId: companyA.id,
        type: "RECEIVABLE",
        description: "Referência cruzada",
        categoryId: categoryB.id,
        originalAmountCents: 100n,
        competenceDate: new Date("2026-09-01"),
        dueDate: new Date("2026-09-01"),
      },
    })).rejects.toThrow();
  });
});

describe("saldo inicial da conta (FIN-002)", () => {
  it("saldo de abertura é gravado como posição patrimonial, não como receita", async () => {
    const user = await registerUser({
      email: uniqueEmail("owner"),
      name: "Proprietária",
      password: "senha-forte-789",
    });
    const company = await createCompany(user.id, { name: "Empresa com saldo" });

    const account = await createFinancialAccount(user.id, company.id, {
      name: "Conta corrente",
      type: "BANK",
      openingBalanceCents: 150_000,
      openingDate: "2026-01-15",
    });

    expect(account.openingBalanceCents).toBe(150_000n);
    expect(account.currency).toBe("BRL");

    const accounts = await listFinancialAccounts(user.id, company.id);
    expect(accounts).toHaveLength(1);
    expect(accounts[0]?.openingBalanceCents).toBe(150_000n);
    // Não existe (ainda) nenhuma tabela de título/receita nesta etapa da
    // fundação — o teste documenta a invariante da Seção 8 (saldo inicial
    // não é receita) pelo simples fato de que criar a conta não grava nada
    // além da própria linha em financial_accounts.
  });
});
