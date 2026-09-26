import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { registerUser } from "../identity/register";
import { createCompany } from "../companies/create-company";
import { createFinancialAccount } from "../financial-accounts/create-account";
import { createCategory } from "../categories/create-category";
import { listCategories } from "../categories/list-categories";
import { createTitle } from "../titles/create-title";
import { listTitles } from "../titles/list-titles";
import { getTitle } from "../titles/get-title";
import { registerSettlement } from "../titles/register-settlement";
import { cancelTitle } from "../titles/cancel-title";
import { reverseSettlement } from "../titles/reverse-settlement";
import {
  CategoryDepthExceededError,
  CategoryNotFoundError,
  CompanyAccessDeniedError,
  SettlementExceedsBalanceError,
  TitleHasActiveSettlementsError,
} from "../errors";
import { rootClient, resetDatabase } from "./test-db";

function uniqueEmail(label: string) {
  return `${label}.${randomUUID()}@teste.ax.finance`;
}

async function setupCompanyWithAccount(label: string) {
  const user = await registerUser({
    email: uniqueEmail(label),
    name: `Usuária ${label}`,
    password: "senha-forte-123",
  });
  const company = await createCompany(user.id, { name: `Empresa ${label}` });
  const account = await createFinancialAccount(user.id, company.id, {
    name: "Conta principal",
    type: "BANK",
    openingBalanceCents: 0,
    openingDate: "2026-01-01",
  });
  const category = await createCategory(user.id, company.id, {
    name: "Serviços",
    nature: "OPERATING_REVENUE",
  });
  return { user, company, account, category };
}

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await rootClient.$disconnect();
});

describe("categorias (Seção 9)", () => {
  it("recusa um terceiro nível e recusa pai de outra empresa", async () => {
    const { user, company, category } = await setupCompanyWithAccount("cat-a");
    const other = await setupCompanyWithAccount("cat-b");

    const sub = await createCategory(user.id, company.id, {
      name: "Consultoria",
      nature: "OPERATING_REVENUE",
      parentId: category.id,
    });

    await expect(
      createCategory(user.id, company.id, {
        name: "Sub-sub",
        nature: "OPERATING_REVENUE",
        parentId: sub.id,
      })
    ).rejects.toBeInstanceOf(CategoryDepthExceededError);

    await expect(
      createCategory(user.id, company.id, {
        name: "Inválida",
        nature: "OPERATING_REVENUE",
        parentId: other.category.id,
      })
    ).rejects.toBeInstanceOf(CategoryNotFoundError);

    const categories = await listCategories(user.id, company.id);
    expect(categories.map((c) => c.name).sort()).toEqual(["Consultoria", "Serviços"]);
  });
});

describe("títulos e baixas (Seções 6/7/18)", () => {
  it("baixa parcial deixa saldo residual e status correto", async () => {
    const { user, company, account, category } = await setupCompanyWithAccount("parcial");

    const title = await createTitle(user.id, company.id, {
      type: "RECEIVABLE",
      description: "Serviço de instalação",
      categoryId: category.id,
      originalAmountCents: 100_000,
      competenceDate: "2026-01-01",
      dueDate: "2026-01-31",
    });

    await registerSettlement(user.id, company.id, title.id, {
      financialAccountId: account.id,
      principalAmountCents: 40_000,
      effectiveDate: "2026-01-15",
    });

    const detail = await getTitle(user.id, company.id, title.id);
    expect(detail.remainingCents).toBe(60_000n);
    expect(detail.status).toBe("PARTIALLY_SETTLED");
  });

  it("desconto extingue principal junto com o valor recebido (exemplo da Seção 6)", async () => {
    const { user, company, account, category } = await setupCompanyWithAccount("desconto");

    const title = await createTitle(user.id, company.id, {
      type: "RECEIVABLE",
      description: "Título com desconto",
      categoryId: category.id,
      originalAmountCents: 10_000,
      competenceDate: "2026-01-01",
      dueDate: "2026-01-31",
    });

    await registerSettlement(user.id, company.id, title.id, {
      financialAccountId: account.id,
      principalAmountCents: 9_000,
      discountCents: 1_000,
      effectiveDate: "2026-01-10",
    });

    const detail = await getTitle(user.id, company.id, title.id);
    expect(detail.remainingCents).toBe(0n);
    expect(detail.status).toBe("SETTLED");
  });

  it("taxa retida não reduz o saldo em aberto (exemplo da Seção 6)", async () => {
    const { user, company, account, category } = await setupCompanyWithAccount("taxa");

    const title = await createTitle(user.id, company.id, {
      type: "RECEIVABLE",
      description: "Título com taxa de PSP",
      categoryId: category.id,
      originalAmountCents: 100_000,
      competenceDate: "2026-01-01",
      dueDate: "2026-01-31",
    });

    await registerSettlement(user.id, company.id, title.id, {
      financialAccountId: account.id,
      principalAmountCents: 40_000,
      feesCents: 800,
      effectiveDate: "2026-01-10",
    });

    const detail = await getTitle(user.id, company.id, title.id);
    expect(detail.remainingCents).toBe(60_000n);
  });

  it("rejeita baixa acima do saldo aberto", async () => {
    const { user, company, account, category } = await setupCompanyWithAccount("excede");

    const title = await createTitle(user.id, company.id, {
      type: "PAYABLE",
      description: "Conta a pagar",
      categoryId: category.id,
      originalAmountCents: 5_000,
      competenceDate: "2026-01-01",
      dueDate: "2026-01-31",
    });

    await expect(
      registerSettlement(user.id, company.id, title.id, {
        financialAccountId: account.id,
        principalAmountCents: 5_001,
        effectiveDate: "2026-01-10",
      })
    ).rejects.toBeInstanceOf(SettlementExceedsBalanceError);
  });

  it("duas baixas concorrentes acima do saldo: só uma é aceita (Seção 30)", async () => {
    const { user, company, account, category } = await setupCompanyWithAccount("concorrencia");

    const title = await createTitle(user.id, company.id, {
      type: "RECEIVABLE",
      description: "Título disputado",
      categoryId: category.id,
      originalAmountCents: 10_000,
      competenceDate: "2026-01-01",
      dueDate: "2026-01-31",
    });

    const attempt = () =>
      registerSettlement(user.id, company.id, title.id, {
        financialAccountId: account.id,
        principalAmountCents: 7_000,
        effectiveDate: "2026-01-10",
      });

    const results = await Promise.allSettled([attempt(), attempt()]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const detail = await getTitle(user.id, company.id, title.id);
    expect(detail.remainingCents).toBe(3_000n);
  });

  it("cancelamento é bloqueado com baixa ativa e permitido sem baixa", async () => {
    const { user, company, account, category } = await setupCompanyWithAccount("cancelar");

    const withSettlement = await createTitle(user.id, company.id, {
      type: "PAYABLE",
      description: "Com baixa",
      categoryId: category.id,
      originalAmountCents: 1_000,
      competenceDate: "2026-01-01",
      dueDate: "2026-01-31",
    });
    await registerSettlement(user.id, company.id, withSettlement.id, {
      financialAccountId: account.id,
      principalAmountCents: 500,
      effectiveDate: "2026-01-05",
    });

    await expect(
      cancelTitle(user.id, company.id, withSettlement.id, { reason: "teste" })
    ).rejects.toBeInstanceOf(TitleHasActiveSettlementsError);

    const withoutSettlement = await createTitle(user.id, company.id, {
      type: "PAYABLE",
      description: "Sem baixa",
      categoryId: category.id,
      originalAmountCents: 1_000,
      competenceDate: "2026-01-01",
      dueDate: "2026-01-31",
    });
    const cancelled = await cancelTitle(user.id, company.id, withoutSettlement.id, {
      reason: "não será mais pago",
    });
    expect(cancelled.status).toBe("CANCELLED");
  });

  it("estorno reabre o saldo sem apagar a baixa original", async () => {
    const { user, company, account, category } = await setupCompanyWithAccount("estorno");

    const title = await createTitle(user.id, company.id, {
      type: "RECEIVABLE",
      description: "Título estornável",
      categoryId: category.id,
      originalAmountCents: 10_000,
      competenceDate: "2026-01-01",
      dueDate: "2026-01-31",
    });

    const settlement = await registerSettlement(user.id, company.id, title.id, {
      financialAccountId: account.id,
      principalAmountCents: 10_000,
      effectiveDate: "2026-01-10",
    });

    let detail = await getTitle(user.id, company.id, title.id);
    expect(detail.status).toBe("SETTLED");

    await reverseSettlement(user.id, company.id, settlement.id, { reason: "pagamento não confirmado" });

    detail = await getTitle(user.id, company.id, title.id);
    expect(detail.status).toBe("OPEN");
    expect(detail.remainingCents).toBe(10_000n);
    // A baixa original continua existindo, só marcada como estornada.
    expect(detail.settlements).toHaveLength(1);
    expect(detail.settlements[0]?.reversedAt).not.toBeNull();
  });

  it("isolamento: usuário de outra empresa não lista nem acessa título", async () => {
    const owner = await setupCompanyWithAccount("titulo-owner");
    const outsider = await setupCompanyWithAccount("titulo-outsider");

    const title = await createTitle(owner.user.id, owner.company.id, {
      type: "RECEIVABLE",
      description: "Título privado",
      categoryId: owner.category.id,
      originalAmountCents: 1_000,
      competenceDate: "2026-01-01",
      dueDate: "2026-01-31",
    });

    const titlesForOutsider = await listTitles(outsider.user.id, outsider.company.id);
    expect(titlesForOutsider).toHaveLength(0);

    await expect(getTitle(outsider.user.id, owner.company.id, title.id)).rejects.toBeInstanceOf(
      CompanyAccessDeniedError
    );
  });
});
