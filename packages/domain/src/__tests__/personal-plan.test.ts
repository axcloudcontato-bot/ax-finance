import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { registerUser } from "../identity/register";
import { createCompany } from "../companies/create-company";
import { getCompanyPlanAccess } from "../subscriptions/plan-features";
import { listPeriodClosures } from "../closures/list-period-closures";
import { listAuditEvents } from "../audit/list-audit-events";
import { getManagerialIncomeStatement } from "../reports/managerial-income-statement";
import { listBankStatementLines } from "../reconciliation/list-bank-statement-lines";
import { getDashboardOverview } from "../reports/dashboard-overview";
import { rootClient, resetDatabase } from "./test-db";

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await rootClient.$disconnect();
});

describe("plano Gestão Pessoal", () => {
  it("custa R$ 29,90 e bloqueia os quatro recursos exclusivos", async () => {
    const user = await registerUser({
      email: `pessoal.${randomUUID()}@teste.ax.finance`,
      name: "Usuária Pessoal",
      password: "senha-forte-123",
    });
    const company = await createCompany(user.id, { name: "Finanças pessoais", planCode: "PERSONAL" });

    await expect(getCompanyPlanAccess(user.id, company.id)).resolves.toMatchObject({
      code: "PERSONAL",
      name: "Gestão Pessoal",
      monthlyPriceCents: 2990,
      features: [],
    });

    await Promise.all([
      expect(listPeriodClosures(user.id, company.id)).rejects.toMatchObject({ code: "PLAN_FEATURE_UNAVAILABLE" }),
      expect(listAuditEvents(user.id, company.id)).rejects.toMatchObject({ code: "PLAN_FEATURE_UNAVAILABLE" }),
      expect(getManagerialIncomeStatement(user.id, company.id, { from: "2026-09-01", to: "2026-09-30" })).rejects.toMatchObject({ code: "PLAN_FEATURE_UNAVAILABLE" }),
      expect(listBankStatementLines(user.id, company.id)).rejects.toMatchObject({ code: "PLAN_FEATURE_UNAVAILABLE" }),
    ]);
  });

  it("mantém o dashboard, mas remove alertas e leitura de conciliação", async () => {
    const user = await registerUser({
      email: `painel-pessoal.${randomUUID()}@teste.ax.finance`,
      name: "Usuária Dashboard",
      password: "senha-forte-123",
    });
    const company = await createCompany(user.id, { name: "Painel pessoal", planCode: "PERSONAL" });
    const overview = await getDashboardOverview(user.id, company.id, {
      from: "2026-09-01",
      to: "2026-09-30",
      today: "2026-09-29",
    });

    expect(overview.reconciliation).toEqual({
      available: false,
      pendingCount: 0,
      pendingAmountCents: 0n,
      oldestPendingDate: null,
      failedImportCount: 0,
    });
  });
});
