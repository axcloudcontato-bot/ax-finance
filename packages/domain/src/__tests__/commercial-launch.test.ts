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
import { rootClient, resetDatabase } from "./test-db";

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
    const archive = await buildCompanyFinalExport(user.id, company.id, new Date("2026-09-29T12:00:00Z"));
    expect(archive).toMatchObject({ format: "ax-finance-company-export", version: 1, company: { id: company.id }, titles: [{ description: "Projeto piloto" }] });
    expect(await rootClient.auditEvent.findFirst({ where: { eventType: "COMPANY_FINAL_EXPORT_GENERATED" } })).not.toBeNull();
  });
});
