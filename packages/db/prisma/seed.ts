import { registerUser, createCompany, createFinancialAccount } from "@ax-finance/domain";
import { prisma } from "../src/client";

/**
 * Dados de demonstração — nunca rodar contra um banco de produção.
 * Passa pela camada de domínio (não INSERT direto) para que as mesmas
 * regras de RLS/contexto que a aplicação usa também valham para o seed
 * (Seção 4/16 do DIRECAO.md: separar demo de dados reais, mas sem atalhos
 * que burlem o isolamento).
 */
async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Seed de demonstração não pode rodar em produção.");
  }

  const user = await registerUser({
    email: "demo@ax.finance",
    name: "Usuário Demo",
    password: "demo12345",
  });

  const company = await createCompany(user.id, {
    name: "[DEMO] Instalações Rápidas Ltda",
    currency: "BRL",
    timezone: "America/Sao_Paulo",
  });

  await createFinancialAccount(user.id, company.id, {
    name: "Conta corrente principal",
    type: "BANK",
    currency: "BRL",
    openingBalanceCents: 500_000,
    openingDate: new Date().toISOString(),
  });

  console.log("Seed concluído: demo@ax.finance / demo12345");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
