import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { registerUser } from "../identity/register";
import { createCompany } from "../companies/create-company";
import { createCategory } from "../categories/create-category";
import { createFinancialAccount } from "../financial-accounts/create-account";
import { createTitle } from "../titles/create-title";
import { createCompanySupportCase, listCompanySupportCases } from "../support/company-support";
import { buildCompanyFinalExport } from "../exports/company-export";
import { scheduleSubscriptionCancellation, undoSubscriptionCancellation } from "../subscriptions/subscriptions";
import { prisma, withUserContext } from "@ax-finance/db";
import { decodeSupportCaseOpenedPayload } from "../outbox/events";
import { rootClient, resetDatabase } from "./test-db";
import { createAsset, createDebt } from "../wealth/wealth";
import { createSavingsGoal } from "../savings-goals/savings-goals";
import { closePeriod } from "../closures/close-period";

async function setup() {
  const user = await registerUser({ email: `launch.${randomUUID()}@teste.ax.finance`, name: "Proprietário", password: "senha-forte-123" });
  const company = await createCompany(user.id, { name: "Empresa piloto" });
  return { user, company };
}

beforeEach(resetDatabase);
afterAll(async () => rootClient.$disconnect());

describe("preparação comercial", () => {
  it("permite que cliente abra e acompanhe chamado apenas da própria empresa", async () => {
    const { user, company } = await setup();
    await createCompanySupportCase(user.id, company.id, { subject: "Importação não concluiu", summary: "O arquivo ficou processando por mais de vinte minutos.", contactEmail: user.email, priority: "HIGH" });
    expect(await listCompanySupportCases(user.id, company.id)).toMatchObject([{ subject: "Importação não concluiu", status: "OPEN", priority: "HIGH" }]);
  });

  it("chamado aberto avisa a equipe interna; a lista de destinatários só sai para o worker", async () => {
    const { user, company } = await setup();
    const admin = await registerUser({ email: `suporte.${randomUUID()}@teste.ax.finance`, name: "Equipe de suporte", password: "senha-forte-123" });
    const analyst = await registerUser({ email: `analista.${randomUUID()}@teste.ax.finance`, name: "Analista", password: "senha-forte-123" });
    await rootClient.platformAdmin.createMany({ data: [{ userId: admin.id, role: "SUPPORT" }, { userId: analyst.id, role: "ANALYST" }] });

    const created = await createCompanySupportCase(user.id, company.id, { subject: "Não consigo conciliar", summary: "As linhas do extrato não aparecem depois da importação.", contactEmail: user.email, priority: "NORMAL" });
    const events = await rootClient.outboxEvent.findMany({ where: { type: "SUPPORT_CASE_OPENED" } });
    expect(events).toHaveLength(1);
    expect(decodeSupportCaseOpenedPayload(events[0]!)).toMatchObject({ caseId: created.id, companyName: "Empresa piloto", openedByName: "Proprietário", subject: "Não consigo conciliar", priority: "NORMAL" });

    // Worker (sem usuário no contexto): só quem atende chamados; analista fica de fora.
    const recipients = await prisma.$queryRaw<{ email: string }[]>`SELECT email FROM app_support_case_recipients()`;
    expect(recipients.map((row) => row.email)).toEqual([admin.email]);
    // Em nome de um cliente, a função não devolve ninguém.
    const asCustomer = await withUserContext(user.id, (tx) => tx.$queryRaw<{ email: string }[]>`SELECT email FROM app_support_case_recipients()`);
    expect(asCustomer).toEqual([]);
  });

  it("agenda e desfaz cancelamento com auditoria", async () => {
    const { user, company } = await setup();
    const now = new Date("2026-09-29T12:00:00Z");
    const scheduled = await scheduleSubscriptionCancellation(user.id, company.id, now);
    expect(scheduled.status).toBe("CANCELLATION_SCHEDULED");
    expect(scheduled.cancellationEffectiveAt).toEqual(scheduled.trialEndsAt);
    const restored = await undoSubscriptionCancellation(user.id, company.id, now);
    expect(restored).toMatchObject({ status: "TRIAL", cancellationEffectiveAt: null });
    expect(await rootClient.auditEvent.count({ where: { companyId: company.id } })).toBe(2);
  });

  it("gera exportação final completa e registra o acesso", async () => {
    const { user, company } = await setup();
    const category = await createCategory(user.id, company.id, { name: "Serviços", nature: "OPERATING_REVENUE" });
    await createFinancialAccount(user.id, company.id, { name: "Conta principal", type: "BANK", openingBalanceCents: 50000, openingDate: "2026-09-01" });
    await createTitle(user.id, company.id, { type: "RECEIVABLE", description: "Projeto piloto", categoryId: category.id, originalAmountCents: 150000, competenceDate: "2026-09-01", dueDate: "2026-09-30" });
    const expense = await createCategory(user.id, company.id, { name: "Financiamento", nature: "FINANCING" });
    const asset = await createAsset(user.id, company.id, { name: "Equipamento", kind: "OTHER", valueCents: 10000, valuedAt: "2026-09-01" });
    const debt = await createDebt(user.id, company.id, { name: "Crédito", principalCents: 10000, monthlyRateBps: 0, installmentCount: 2, firstDueDate: "2026-09-01", amortization: "SAC", categoryId: expense.id });
    const goal = await createSavingsGoal(user.id, company.id, { name: "Reserva", targetAmountCents: 10000, color: "green", icon: "shield" });
    await closePeriod(user.id, company.id, { period: "2026-09" });
    const archive = await buildCompanyFinalExport(user.id, company.id, new Date("2026-09-29T12:00:00Z"));
    expect(archive).toMatchObject({ format: "ax-finance-company-export", version: 2, company: { id: company.id }, assets: [{ id: asset.id }], debts: [{ id: debt.id }], savingsGoals: [{ id: goal.id }], reportSnapshots: [{ period: "2026-09" }] });
    expect(archive.titles.some((title) => title.description === "Projeto piloto")).toBe(true);
    expect(await rootClient.auditEvent.findFirst({ where: { eventType: "COMPANY_FINAL_EXPORT_GENERATED" } })).not.toBeNull();
  });
});
