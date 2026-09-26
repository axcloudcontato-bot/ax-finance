import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { registerUser } from "../identity/register";
import { createCompany } from "../companies/create-company";
import { createFinancialAccount } from "../financial-accounts/create-account";
import { createCategory } from "../categories/create-category";
import { createParty } from "../parties/create-party";
import { createTitle } from "../titles/create-title";
import { registerSettlement } from "../titles/register-settlement";
import { listDueSoonTitles } from "../titles/list-due-soon-titles";
import { searchRecords } from "../search/search-records";
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
    openingBalanceCents: 100_000,
    openingDate: "2026-01-01",
  });
  const category = await createCategory(user.id, company.id, {
    name: "Serviços de instalação",
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

describe("notificações do topbar (vencidos/vencendo hoje)", () => {
  it("lista só títulos em aberto com vencimento até hoje, mais antigos primeiro", async () => {
    const { user, company, category } = await setupCompanyWithAccount("notif");

    const vencido = await createTitle(user.id, company.id, {
      type: "RECEIVABLE",
      description: "Vencido há dias",
      categoryId: category.id,
      originalAmountCents: 10_000,
      competenceDate: "2026-09-01",
      dueDate: "2026-09-01",
    });
    await createTitle(user.id, company.id, {
      type: "PAYABLE",
      description: "Vence só ano que vem",
      categoryId: category.id,
      originalAmountCents: 20_000,
      competenceDate: "2026-09-10",
      dueDate: "2027-01-01",
    });

    const dueSoon = await listDueSoonTitles(user.id, company.id);
    expect(dueSoon.map((t) => t.id)).toEqual([vencido.id]);
  });

  it("não lista título cancelado/quitado mesmo vencido", async () => {
    const { user, company, account, category } = await setupCompanyWithAccount("notif-quitado");

    const title = await createTitle(user.id, company.id, {
      type: "RECEIVABLE",
      description: "Vencido mas quitado",
      categoryId: category.id,
      originalAmountCents: 10_000,
      competenceDate: "2026-09-01",
      dueDate: "2026-09-01",
    });
    await registerSettlement(user.id, company.id, title.id, {
      financialAccountId: account.id,
      principalAmountCents: 10_000,
      effectiveDate: "2026-09-01",
    });

    const dueSoon = await listDueSoonTitles(user.id, company.id);
    expect(dueSoon).toHaveLength(0);
  });

  it("isola entre empresas", async () => {
    const owner = await setupCompanyWithAccount("notif-iso-owner");
    const outsider = await setupCompanyWithAccount("notif-iso-outsider");

    await createTitle(owner.user.id, owner.company.id, {
      type: "RECEIVABLE",
      description: "Vencido do dono",
      categoryId: owner.category.id,
      originalAmountCents: 10_000,
      competenceDate: "2026-09-01",
      dueDate: "2026-09-01",
    });

    const dueSoonForOutsider = await listDueSoonTitles(outsider.user.id, outsider.company.id);
    expect(dueSoonForOutsider).toHaveLength(0);
  });
});

describe("busca global do topbar", () => {
  it("encontra título, pessoa e categoria por texto parcial, sem diferenciar maiúsculas", async () => {
    const { user, company, category } = await setupCompanyWithAccount("busca");

    const title = await createTitle(user.id, company.id, {
      type: "RECEIVABLE",
      description: "Consultoria de rede para Fulano",
      categoryId: category.id,
      originalAmountCents: 10_000,
      competenceDate: "2026-09-10",
      dueDate: "2026-09-10",
    });
    const party = await createParty(user.id, company.id, {
      name: "Fulano de Tal Serviços",
      isClient: true,
    });

    const results = await searchRecords(user.id, company.id, "fulano");
    expect(results.titles.map((t) => t.id)).toEqual([title.id]);
    expect(results.parties.map((p) => p.id)).toEqual([party.id]);

    const categoryResults = await searchRecords(user.id, company.id, "instalação");
    expect(categoryResults.categories.map((c) => c.id)).toEqual([category.id]);
  });

  it("não busca com menos de 2 caracteres", async () => {
    const { user, company } = await setupCompanyWithAccount("busca-curta");

    const results = await searchRecords(user.id, company.id, "a");
    expect(results).toEqual({ titles: [], parties: [], categories: [] });
  });

  it("isola busca entre empresas", async () => {
    const owner = await setupCompanyWithAccount("busca-iso-owner");
    const outsider = await setupCompanyWithAccount("busca-iso-outsider");

    await createTitle(owner.user.id, owner.company.id, {
      type: "RECEIVABLE",
      description: "Segredo do dono",
      categoryId: owner.category.id,
      originalAmountCents: 10_000,
      competenceDate: "2026-09-10",
      dueDate: "2026-09-10",
    });

    const results = await searchRecords(outsider.user.id, outsider.company.id, "segredo");
    expect(results.titles).toHaveLength(0);
  });
});
