import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { registerUser } from "../identity/register";
import { createCompany } from "../companies/create-company";
import { createCategory } from "../categories/create-category";
import { createFinancialAccount } from "../financial-accounts/create-account";
import { createTitle } from "../titles/create-title";
import { registerSettlement } from "../titles/register-settlement";
import { cancelTitle } from "../titles/cancel-title";
import { listTitles, listTitlesPage } from "../titles/list-titles";
import { rootClient, resetDatabase } from "./test-db";

function uniqueEmail(label: string) {
  return `${label}.${randomUUID()}@teste.ax.finance`;
}

const TODAY = "2026-10-10";
const PERIOD = { from: "2026-10-01", to: "2026-10-31", today: TODAY };

async function setup(label: string) {
  const user = await registerUser({ email: uniqueEmail(label), name: `Usuária ${label}`, password: "senha-forte-123" });
  const company = await createCompany(user.id, { name: `Empresa ${label}` });
  const account = await createFinancialAccount(user.id, company.id, { name: "Conta", type: "BANK", openingBalanceCents: 0, openingDate: "2026-01-01" });
  const category = await createCategory(user.id, company.id, { name: "Aluguel", nature: "EXPENSE" });
  const make = (description: string, dueDate: string, cents: number) =>
    createTitle(user.id, company.id, { type: "PAYABLE", description, categoryId: category.id, originalAmountCents: cents, competenceDate: dueDate, dueDate });
  return { user, company, account, make };
}

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await rootClient.$disconnect();
});

describe("lista de títulos paginada, filtrada no banco", () => {
  it("cada visão devolve o mesmo que o filtro antigo em memória e o resumo cobre o conjunto inteiro", async () => {
    const { user, company, account, make } = await setup("visoes");
    await make("Vencida de setembro", "2026-09-20", 10_000);
    await make("Vence hoje", TODAY, 20_000);
    await make("Próxima", "2026-10-20", 30_000);
    const paid = await make("Quitada", "2026-10-05", 40_000);
    await registerSettlement(user.id, company.id, paid.id, { financialAccountId: account.id, principalAmountCents: 40_000, effectiveDate: "2026-10-05" });
    const partial = await make("Parcial vencida", "2026-10-02", 50_000);
    await registerSettlement(user.id, company.id, partial.id, { financialAccountId: account.id, principalAmountCents: 20_000, effectiveDate: "2026-10-03" });
    const cancelled = await make("Cancelada", "2026-10-25", 60_000);
    await cancelTitle(user.id, company.id, cancelled.id, { reason: "teste" });
    await make("Fora do período", "2026-11-15", 70_000);

    const names = async (view: "todas" | "vencidas" | "hoje" | "proximas" | "quitadas") =>
      (await listTitlesPage(user.id, company.id, { type: "PAYABLE", view, ...PERIOD })).titles.map((title) => title.description);

    expect(await names("todas")).toEqual(["Parcial vencida", "Quitada", "Vence hoje", "Próxima", "Cancelada"]);
    expect(await names("vencidas")).toEqual(["Vencida de setembro", "Parcial vencida"]);
    expect(await names("hoje")).toEqual(["Vence hoje"]);
    expect(await names("proximas")).toEqual(["Próxima"]);
    expect(await names("quitadas")).toEqual(["Quitada"]);

    const all = await listTitlesPage(user.id, company.id, { type: "PAYABLE", view: "todas", ...PERIOD });
    expect(all.total).toBe(5);
    // Em aberto no período: parcial (30.000 restantes) + hoje + próxima; vencido: só a parcial.
    expect(all.summary).toMatchObject({ openCount: 3, overdueCount: 1 });
    expect(Number(all.summary.openCents)).toBe(30_000 + 20_000 + 30_000);
    expect(Number(all.summary.overdueCents)).toBe(30_000);
    expect(all.summary.oldestOverdueDate?.toISOString().slice(0, 10)).toBe("2026-10-02");

    const overdue = await listTitlesPage(user.id, company.id, { type: "PAYABLE", view: "vencidas", ...PERIOD });
    expect(overdue.summary.oldestOverdueDate?.toISOString().slice(0, 10)).toBe("2026-09-20");
    expect(Number(overdue.summary.overdueCents)).toBe(10_000 + 30_000);

    // O saldo de cada linha sai igual ao da listagem completa.
    const full = await listTitles(user.id, company.id, { type: "PAYABLE" });
    for (const row of all.titles) {
      expect(row.remainingCents).toBe(full.find((title) => title.id === row.id)!.remainingCents);
    }
  });

  it("pagina sem perder nem repetir linhas, e o resumo não depende da página", async () => {
    const { user, company, make } = await setup("paginas");
    for (let day = 1; day <= 7; day++) await make(`Conta ${day}`, `2026-10-0${day}`, 1_000 * day);

    const first = await listTitlesPage(user.id, company.id, { type: "PAYABLE", ...PERIOD, page: 1, pageSize: 3 });
    const second = await listTitlesPage(user.id, company.id, { type: "PAYABLE", ...PERIOD, page: 2, pageSize: 3 });
    const third = await listTitlesPage(user.id, company.id, { type: "PAYABLE", ...PERIOD, page: 3, pageSize: 3 });

    expect([first, second, third].map((page) => page.titles.length)).toEqual([3, 3, 1]);
    expect(first.pageCount).toBe(3);
    const ids = [...first.titles, ...second.titles, ...third.titles].map((title) => title.id);
    expect(new Set(ids).size).toBe(7);
    expect(first.summary).toEqual(third.summary);

    const beyond = await listTitlesPage(user.id, company.id, { type: "PAYABLE", ...PERIOD, page: 99, pageSize: 3 });
    expect(beyond.page).toBe(3);
  });

  it("lista vazia tem uma página e resumo zerado; outra empresa não aparece", async () => {
    const mine = await setup("vazia");
    const other = await setup("outra");
    await other.make("Da outra empresa", "2026-10-15", 5_000);

    const result = await listTitlesPage(mine.user.id, mine.company.id, { type: "PAYABLE", ...PERIOD });
    expect(result).toMatchObject({ total: 0, page: 1, pageCount: 1, titles: [] });
    expect(result.summary).toMatchObject({ openCount: 0, overdueCount: 0, oldestOverdueDate: null });
    expect(Number(result.summary.openCents)).toBe(0);
  });

  it("listTitles aceita só os ids pedidos (telas de lote)", async () => {
    const { user, company, make } = await setup("ids");
    const a = await make("A", "2026-10-01", 100);
    await make("B", "2026-10-02", 200);
    const only = await listTitles(user.id, company.id, { type: "PAYABLE", ids: [a.id] });
    expect(only.map((title) => title.description)).toEqual(["A"]);
  });
});
