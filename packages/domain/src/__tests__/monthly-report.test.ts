import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { registerUser } from "../identity/register";
import { createCompany } from "../companies/create-company";
import { createFinancialAccount } from "../financial-accounts/create-account";
import { createCategory } from "../categories/create-category";
import { createTitle } from "../titles/create-title";
import { registerSettlement } from "../titles/register-settlement";
import { generateMonthlyReports, getMonthlyReportData, queueMonthlyReportForUser, renderMonthlyReportPdf } from "../reports/monthly-report";
import { decodeMonthlyReportPayload } from "../outbox/events";
import { updateNotificationPreference } from "../notifications/preferences";
import { rootClient, resetDatabase } from "./test-db";

beforeEach(async () => resetDatabase());
afterAll(async () => rootClient.$disconnect());

async function setup() {
  const user = await registerUser({ email: `mensal.${randomUUID()}@teste.ax.finance`, name: "Dona", password: "senha-forte-123" });
  await rootClient.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
  const company = await createCompany(user.id, { name: "Padaria São João" });
  const account = await createFinancialAccount(user.id, company.id, { name: "Banco", type: "BANK", openingBalanceCents: 100_000, openingDate: "2026-01-01" });
  const sales = await createCategory(user.id, company.id, { name: "Vendas", nature: "OPERATING_REVENUE" });
  const rent = await createCategory(user.id, company.id, { name: "Aluguel", nature: "EXPENSE" });
  const energy = await createCategory(user.id, company.id, { name: "Energia", nature: "EXPENSE" });
  const sale = await createTitle(user.id, company.id, { type: "RECEIVABLE", description: "Vendas de setembro", categoryId: sales.id, originalAmountCents: 500_000, competenceDate: "2026-09-10", dueDate: "2026-09-10" });
  await registerSettlement(user.id, company.id, sale.id, { financialAccountId: account.id, principalAmountCents: 300_000, effectiveDate: "2026-09-12" });
  await createTitle(user.id, company.id, { type: "PAYABLE", description: "Aluguel", categoryId: rent.id, originalAmountCents: 200_000, competenceDate: "2026-09-05", dueDate: "2026-09-05" });
  await createTitle(user.id, company.id, { type: "PAYABLE", description: "Luz", categoryId: energy.id, originalAmountCents: 50_000, competenceDate: "2026-09-20", dueDate: "2026-09-20" });
  return { user, company };
}

describe("relatório mensal", () => {
  it("reúne resultado, caixa, maiores gastos e inadimplência, e gera o PDF", async () => {
    const { user, company } = await setup();
    const data = await getMonthlyReportData(user.id, company.id, "2026-09");
    expect(data.monthLabel).toBe("Setembro de 2026");
    expect(data.result).toMatchObject({ revenueCents: 500_000n, expenseCents: 250_000n, resultCents: 250_000n });
    expect(data.cash).toEqual({ receivedCents: 300_000n, paidCents: 0n });
    expect(data.topExpenses.map((item) => item.name)).toEqual(["Aluguel", "Energia"]);
    expect(data.delinquency.overdueReceivableCents).toBe(200_000n);

    const pdf = await renderMonthlyReportPdf(data);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(1500);
  });

  it("enfileira um e-mail por pessoa e mês, só nos primeiros dias e respeitando a preferência", async () => {
    const { user, company } = await setup();
    const early = new Date("2026-10-02T15:00:00Z"); // 12h em São Paulo, dia 2
    const late = new Date("2026-10-12T15:00:00Z");
    expect((await generateMonthlyReports(user.id, company.id, "https://app.example.com", late)).emailsQueued).toBe(0);
    expect((await generateMonthlyReports(user.id, company.id, "https://app.example.com", early)).emailsQueued).toBe(1);
    expect((await generateMonthlyReports(user.id, company.id, "https://app.example.com", early)).emailsQueued).toBe(0); // já enfileirado

    const event = await rootClient.outboxEvent.findFirstOrThrow({ where: { type: "MONTHLY_REPORT" } });
    expect(decodeMonthlyReportPayload(event)).toMatchObject({ month: "2026-09", companyId: company.id, userId: user.id, companyName: "Padaria São João" });

    await rootClient.outboxEvent.deleteMany({});
    await updateNotificationPreference(user.id, company.id, { inAppDue: true, emailDue: true, inAppWeekly: true, emailWeekly: true, emailMonthlyReport: false, dueDaysAhead: 0, deliveryHour: 8 });
    expect((await generateMonthlyReports(user.id, company.id, "https://app.example.com", early)).emailsQueued).toBe(0);

    // pedido manual vale mesmo com o automático desligado
    await queueMonthlyReportForUser(user.id, company.id, "2026-09", "https://app.example.com");
    expect(await rootClient.outboxEvent.count({ where: { type: "MONTHLY_REPORT" } })).toBe(1);
  });
});
