import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { registerUser } from "../identity/register";
import { createCompany } from "../companies/create-company";
import { createCategory } from "../categories/create-category";
import { createInstallmentPlan } from "../titles/create-installment-plan";
import { listInstallments } from "../titles/list-installments";
import { addMonthsClamped } from "../titles/installment-dates";
import { InstallmentAmountTooSmallError, InstallmentCountInvalidError } from "../errors";
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
  const category = await createCategory(user.id, company.id, {
    name: "Serviços",
    nature: "OPERATING_REVENUE",
  });
  return { user, company, category };
}

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await rootClient.$disconnect();
});

describe("addMonthsClamped (Seção 11)", () => {
  it("cai no último dia do mês que não tem o dia-âncora, sem arrastar o clamp para o mês seguinte", () => {
    expect(addMonthsClamped("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonthsClamped("2026-01-31", 2)).toBe("2026-03-31");
  });

  it("vira o ano quando a soma de meses ultrapassa dezembro", () => {
    expect(addMonthsClamped("2026-11-15", 3)).toBe("2027-02-15");
  });
});

describe("parcelamento (Seção 11)", () => {
  it("divide o total em parcelas iguais, com o resto nas primeiras (exemplo da Seção 11)", async () => {
    const { user, company, category } = await setupCompany("split");

    const titles = await createInstallmentPlan(user.id, company.id, {
      type: "RECEIVABLE",
      description: "Serviço parcelado",
      categoryId: category.id,
      totalAmountCents: 10_000,
      installmentCount: 3,
      firstDueDate: "2026-01-31",
    });

    expect(titles.map((t) => t.originalAmountCents)).toEqual([3334n, 3333n, 3333n]);
    expect(titles.reduce((sum, t) => sum + t.originalAmountCents, 0n)).toBe(10_000n);
    expect(titles.map((t) => t.dueDate.toISOString().slice(0, 10))).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
    ]);
    expect(titles[0]?.installmentCount).toBe(3);
    expect(titles.map((t) => t.installmentNumber)).toEqual([1, 2, 3]);
    expect(new Set(titles.map((t) => t.installmentGroupId)).size).toBe(1);
  });

  it("rejeita menos de 2 parcelas", async () => {
    const { user, company, category } = await setupCompany("count");

    await expect(
      createInstallmentPlan(user.id, company.id, {
        type: "PAYABLE",
        description: "Inválido",
        categoryId: category.id,
        totalAmountCents: 1_000,
        installmentCount: 1,
        firstDueDate: "2026-01-10",
      })
    ).rejects.toBeInstanceOf(InstallmentCountInvalidError);
  });

  it("rejeita valor total pequeno demais para o número de parcelas", async () => {
    const { user, company, category } = await setupCompany("small");

    await expect(
      createInstallmentPlan(user.id, company.id, {
        type: "PAYABLE",
        description: "Inválido",
        categoryId: category.id,
        totalAmountCents: 2,
        installmentCount: 3,
        firstDueDate: "2026-01-10",
      })
    ).rejects.toBeInstanceOf(InstallmentAmountTooSmallError);
  });

  it("listInstallments devolve as parcelas do grupo ordenadas com saldo aberto correto", async () => {
    const { user, company, category } = await setupCompany("list");

    const created = await createInstallmentPlan(user.id, company.id, {
      type: "PAYABLE",
      description: "Equipamento parcelado",
      categoryId: category.id,
      totalAmountCents: 9_000,
      installmentCount: 3,
      firstDueDate: "2026-03-10",
    });

    const installments = await listInstallments(user.id, company.id, created[0]!.installmentGroupId!);

    expect(installments).toHaveLength(3);
    expect(installments.map((t) => t.installmentNumber)).toEqual([1, 2, 3]);
    expect(installments.every((t) => t.remainingCents === t.originalAmountCents)).toBe(true);
  });
});
