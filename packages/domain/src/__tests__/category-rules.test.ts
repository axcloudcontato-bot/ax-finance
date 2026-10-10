import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { registerUser } from "../identity/register";
import { createCompany } from "../companies/create-company";
import { createFinancialAccount } from "../financial-accounts/create-account";
import { createCategory } from "../categories/create-category";
import { createCostCenter } from "../cost-centers/cost-centers";
import { createCategoryRule, deleteCategoryRule, listCategoryRules, matchCategoryRule, updateCategoryRule } from "../categories/category-rules";
import { suggestCategory } from "../ai/suggest-category";
import { importBankStatement } from "../reconciliation/import-bank-statement";
import { launchBankStatementLine, launchBankStatementLinesByRules } from "../reconciliation/launch-bank-statement-line";
import { listFinancialAccountsWithBalance } from "../financial-accounts/account-balances";
import { BankStatementLineAlreadyProcessedError, CategoryRuleNotFoundError } from "../errors";
import { rootClient, resetDatabase } from "./test-db";

beforeEach(async () => resetDatabase());
afterAll(async () => rootClient.$disconnect());

async function setup(label: string) {
  const user = await registerUser({ email: `${label}.${randomUUID()}@teste.ax.finance`, name: label, password: "senha-forte-123" });
  const company = await createCompany(user.id, { name: `Empresa ${label}` });
  const account = await createFinancialAccount(user.id, company.id, { name: "Banco", type: "BANK", openingBalanceCents: 100_000, openingDate: "2026-01-01" });
  const transport = await createCategory(user.id, company.id, { name: "Transporte", nature: "EXPENSE" });
  const food = await createCategory(user.id, company.id, { name: "Alimentação", nature: "EXPENSE" });
  const sales = await createCategory(user.id, company.id, { name: "Vendas", nature: "OPERATING_REVENUE" });
  const commercial = await createCostCenter(user.id, company.id, { name: "Comercial" });
  return { user, company, account, transport, food, sales, commercial };
}

describe("regras de categoria", () => {
  it("casam sem diferenciar maiúsculas e acentos, da mais específica para a mais geral", () => {
    const rules = [
      { id: "1", pattern: "uber", matchType: "CONTAINS" as const, appliesTo: "PAYABLE" as const },
      { id: "2", pattern: "Uber Eats", matchType: "CONTAINS" as const, appliesTo: "PAYABLE" as const },
      { id: "3", pattern: "PIX RECEBIDO", matchType: "STARTS_WITH" as const, appliesTo: "RECEIVABLE" as const },
      { id: "4", pattern: "tarifa", matchType: "EQUALS" as const, appliesTo: "BOTH" as const },
    ];
    expect(matchCategoryRule(rules, "UBER *TRIP SAO PAULO", "PAYABLE")?.id).toBe("1");
    expect(matchCategoryRule(rules, "uber   eats pedido 123", "PAYABLE")?.id).toBe("2");
    expect(matchCategoryRule(rules, "Uber", "RECEIVABLE")).toBeNull();
    expect(matchCategoryRule(rules, "Pix recebido - Fulano", "RECEIVABLE")?.id).toBe("3");
    expect(matchCategoryRule(rules, "Tárifa", "PAYABLE")?.id).toBe("4");
    expect(matchCategoryRule(rules, "Tarifa mensal", "PAYABLE")).toBeNull();
  });

  it("viram a sugestão de categoria (com centro de custo) antes do histórico e da IA", async () => {
    const { user, company, transport, commercial } = await setup("regra-sugestao");
    await createCategoryRule(user.id, company.id, { pattern: "uber", categoryId: transport.id, costCenterId: commercial.id, appliesTo: "PAYABLE" });
    const result = await suggestCategory(user.id, company.id, { description: "Uber viagem cliente", type: "PAYABLE" }, { aiEnabled: false });
    expect(result.suggestion).toMatchObject({ categoryId: transport.id, source: "RULE", costCenterId: commercial.id, rulePattern: "uber" });
    // regra de saída não vale para entrada
    const income = await suggestCategory(user.id, company.id, { description: "Uber reembolso", type: "RECEIVABLE" }, { aiEnabled: false });
    expect(income.suggestion?.source).not.toBe("RULE");
  });

  it("lança e concilia linha do extrato, uma a uma ou todas pelas regras", async () => {
    const { user, company, account, transport, food, sales } = await setup("regra-extrato");
    await createCategoryRule(user.id, company.id, { pattern: "uber", categoryId: transport.id });
    await createCategoryRule(user.id, company.id, { pattern: "ifood", categoryId: food.id, appliesTo: "PAYABLE" });
    await importBankStatement(user.id, company.id, {
      financialAccountId: account.id,
      fileName: "extrato.csv",
      csvContent: "data,descricao,valor\n2026-09-02,UBER TRIP,-23.90\n2026-09-03,IFOOD *RESTAURANTE,-45.00\n2026-09-04,PIX RECEBIDO CLIENTE,150.00\n2026-09-05,UBER TRIP,-12.10",
    });
    const lines = await rootClient.bankStatementLine.findMany({ where: { companyId: company.id }, orderBy: { lineDate: "asc" } });
    const pix = lines.find((line) => line.description.startsWith("PIX"))!;

    // linha sem regra: a pessoa escolhe a categoria
    const manual = await launchBankStatementLine(user.id, company.id, pix.id, { categoryId: sales.id, description: "Venda balcão" });
    expect(manual.title).toMatchObject({ type: "RECEIVABLE", description: "Venda balcão", originalAmountCents: 15_000n });
    await expect(launchBankStatementLine(user.id, company.id, pix.id, { categoryId: sales.id })).rejects.toBeInstanceOf(BankStatementLineAlreadyProcessedError);

    const result = await launchBankStatementLinesByRules(user.id, company.id, { financialAccountId: account.id });
    expect(result).toEqual({ launched: 3, failed: 0 });

    const after = await rootClient.bankStatementLine.findMany({ where: { companyId: company.id } });
    expect(after.every((line) => line.status === "RECONCILED" && line.reconciledSettlementId)).toBe(true);
    const titles = await rootClient.title.findMany({ where: { companyId: company.id }, include: { category: true }, orderBy: { dueDate: "asc" } });
    expect(titles.map((title) => [title.description, title.category.name, title.status])).toEqual([
      ["UBER TRIP", "Transporte", "SETTLED"],
      ["IFOOD *RESTAURANTE", "Alimentação", "SETTLED"],
      ["Venda balcão", "Vendas", "SETTLED"],
      ["UBER TRIP", "Transporte", "SETTLED"],
    ]);
    // 100.000 − 2.390 − 4.500 + 15.000 − 1.210
    const balance = (await listFinancialAccountsWithBalance(user.id, company.id))[0]!.currentBalanceCents;
    expect(balance).toBe(106_900n);
    const rules = await listCategoryRules(user.id, company.id);
    expect(rules.find((rule) => rule.pattern === "uber")?.timesApplied).toBe(2);
  });

  it("edita, exclui e isola por empresa", async () => {
    const first = await setup("regra-a");
    const second = await setup("regra-b");
    const rule = await createCategoryRule(first.user.id, first.company.id, { pattern: "posto", categoryId: first.transport.id });
    await updateCategoryRule(first.user.id, first.company.id, rule.id, { pattern: "posto shell", matchType: "STARTS_WITH", categoryId: first.transport.id });
    expect((await listCategoryRules(first.user.id, first.company.id))[0]).toMatchObject({ pattern: "posto shell", matchType: "STARTS_WITH" });
    expect(await listCategoryRules(second.user.id, second.company.id)).toHaveLength(0);
    await expect(deleteCategoryRule(second.user.id, second.company.id, rule.id)).rejects.toBeInstanceOf(CategoryRuleNotFoundError);
    await deleteCategoryRule(first.user.id, first.company.id, rule.id);
    expect(await listCategoryRules(first.user.id, first.company.id)).toHaveLength(0);
  });
});
