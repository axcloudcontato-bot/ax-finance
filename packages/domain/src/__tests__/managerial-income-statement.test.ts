import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { registerUser } from "../identity/register";
import { createCompany } from "../companies/create-company";
import { createCategory } from "../categories/create-category";
import { createTitle } from "../titles/create-title";
import { cancelTitle } from "../titles/cancel-title";
import { getManagerialIncomeStatement } from "../reports/managerial-income-statement";
import { rootClient, resetDatabase } from "./test-db";

function uniqueEmail(label: string) {
  return `${label}.${randomUUID()}@teste.ax.finance`;
}

async function setupCompany(label: string) {
  const user = await registerUser({
    email: uniqueEmail(label),
    name: `Usuária ${label}`,
    password: "senha-forte-123",
  });
  const company = await createCompany(user.id, { name: `Empresa ${label}` });
  return { user, company };
}

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await rootClient.$disconnect();
});

describe("DRE gerencial básica (Seção 13)", () => {
  it("agrupa por grupo gerencial (ou natureza como fallback), por competência, valor original", async () => {
    const { user, company } = await setupCompany("dre");

    const revenueWithGroup = await createCategory(user.id, company.id, {
      name: "Instalação",
      nature: "OPERATING_REVENUE",
      managerialGroup: "Receita de serviços",
    });
    const expenseNoGroup = await createCategory(user.id, company.id, {
      name: "Aluguel",
      nature: "EXPENSE",
    });

    await createTitle(user.id, company.id, {
      type: "RECEIVABLE",
      description: "Serviço de setembro",
      categoryId: revenueWithGroup.id,
      originalAmountCents: 10_000,
      competenceDate: "2026-09-10",
      dueDate: "2026-09-20",
    });
    // Título ainda em aberto (sem baixa) — precisa entrar pelo valor original,
    // provando que é competência, não caixa.
    await createTitle(user.id, company.id, {
      type: "PAYABLE",
      description: "Aluguel de setembro",
      categoryId: expenseNoGroup.id,
      originalAmountCents: 3_000,
      competenceDate: "2026-09-05",
      dueDate: "2026-09-10",
    });

    const report = await getManagerialIncomeStatement(user.id, company.id, {
      from: "2026-09-01",
      to: "2026-09-30",
    });

    expect(report.groups).toEqual([
      { label: "Receita de serviços", cents: 10_000n },
      { label: "Despesa", cents: -3_000n },
    ]);
    expect(report.totalCents).toBe(7_000n);
  });

  it("exclui título cancelado e título fora do período", async () => {
    const { user, company } = await setupCompany("dre-exclusoes");

    const category = await createCategory(user.id, company.id, {
      name: "Serviços",
      nature: "OPERATING_REVENUE",
    });

    const cancelled = await createTitle(user.id, company.id, {
      type: "RECEIVABLE",
      description: "Vai ser cancelado",
      categoryId: category.id,
      originalAmountCents: 50_000,
      competenceDate: "2026-09-10",
      dueDate: "2026-09-20",
    });
    await cancelTitle(user.id, company.id, cancelled.id, { reason: "teste" });

    await createTitle(user.id, company.id, {
      type: "RECEIVABLE",
      description: "Fora do período",
      categoryId: category.id,
      originalAmountCents: 99_999,
      competenceDate: "2026-08-10",
      dueDate: "2026-08-20",
    });

    const report = await getManagerialIncomeStatement(user.id, company.id, {
      from: "2026-09-01",
      to: "2026-09-30",
    });

    expect(report.groups).toEqual([]);
    expect(report.totalCents).toBe(0n);
  });

  it("isola o relatório entre empresas", async () => {
    const { user, company } = await setupCompany("dre-iso-a");
    const other = await setupCompany("dre-iso-b");

    const category = await createCategory(user.id, company.id, {
      name: "Serviços",
      nature: "OPERATING_REVENUE",
    });
    await createTitle(user.id, company.id, {
      type: "RECEIVABLE",
      description: "Só da empresa A",
      categoryId: category.id,
      originalAmountCents: 1_000,
      competenceDate: "2026-09-10",
      dueDate: "2026-09-20",
    });

    const report = await getManagerialIncomeStatement(other.user.id, other.company.id, {
      from: "2026-09-01",
      to: "2026-09-30",
    });
    expect(report.groups).toEqual([]);
  });
});
