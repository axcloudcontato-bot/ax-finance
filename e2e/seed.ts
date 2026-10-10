/**
 * Dados iniciais dos testes de ponta a ponta, pela camada de domínio (mesmas regras da aplicação).
 * Roda num processo próprio com APP_DATABASE_URL/DATABASE_URL já apontando para o banco de E2E.
 */
import { createCategory, createCategoryRule, createCompany, createFinancialAccount, registerUser } from "@ax-finance/domain";
import { prisma } from "@ax-finance/db";
import { E2E_ACCOUNT, E2E_COMPANY, E2E_USER } from "./fixtures";

async function main() {
  if (!process.env.APP_DATABASE_URL?.includes("ax_finance_e2e")) throw new Error("Seed de E2E só roda no banco ax_finance_e2e.");
  const user = await registerUser({ email: E2E_USER.email, name: E2E_USER.name, password: E2E_USER.password });
  const company = await createCompany(user.id, { name: E2E_COMPANY });
  await createFinancialAccount(user.id, company.id, { name: E2E_ACCOUNT, type: "BANK", openingBalanceCents: 100_000, openingDate: "2026-01-01" });
  await createCategory(user.id, company.id, { name: "Vendas", nature: "OPERATING_REVENUE" });
  const transport = await createCategory(user.id, company.id, { name: "Transporte", nature: "EXPENSE" });
  await createCategoryRule(user.id, company.id, { pattern: "uber", categoryId: transport.id, appliesTo: "PAYABLE" });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
