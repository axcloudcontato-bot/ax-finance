import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { withUserContext } from "@ax-finance/db";
import { registerSettlement } from "../titles/register-settlement";
import { createCompany } from "../companies/create-company";
import { registerUser } from "../identity/register";
import { createCategory } from "../categories/create-category";
import { createFinancialAccount } from "../financial-accounts/create-account";
import { createTitle } from "../titles/create-title";
import { getPlatformAdminAccess } from "../admin/access";
import { listAdminCompanies, updateAdminSubscription } from "../admin/companies";
import { getAdminBusinessMetrics } from "../admin/metrics";
import { getAdminOperations, reprocessDeadLetter, reprocessImportJob, reprocessScheduledJob } from "../admin/operations";
import { createIncident, createSupportCase, listAdminSupport, updateIncident, updateSupportCase } from "../admin/support";
import { PlatformAdminAccessDeniedError, PlatformAdminMfaRequiredError } from "../errors";
import { rootClient, resetDatabase } from "./test-db";

async function setupAdmin(
  label: string,
  role: "SUPER_ADMIN" | "OPERATIONS" | "SUPPORT" | "ANALYST" = "SUPER_ADMIN",
  options: { mfa?: boolean } = {}
) {
  const user = await registerUser({ email: `${label}.${randomUUID()}@teste.ax.finance`, name: `Admin ${label}`, password: "senha-forte-123" });
  const company = await createCompany(user.id, { name: `Empresa ${label}` });
  await rootClient.platformAdmin.create({ data: { userId: user.id, role } });
  if (options.mfa !== false) await rootClient.user.update({ where: { id: user.id }, data: { mfaEnabledAt: new Date() } });
  return { user, company };
}

beforeEach(resetDatabase);
afterAll(async () => rootClient.$disconnect());

describe("painel administrativo interno", () => {
  it("isola o painel de usuários comuns e lista empresas para o administrador", async () => {
    const admin = await setupAdmin("access");
    const common = await registerUser({ email: `common.${randomUUID()}@teste.ax.finance`, name: "Comum", password: "senha-forte-123" });
    await createCompany(common.id, { name: "Empresa comum" });
    expect(await getPlatformAdminAccess(admin.user.id)).toMatchObject({ role: "SUPER_ADMIN" });
    expect(await getPlatformAdminAccess(common.id)).toBeNull();
    await expect(getAdminBusinessMetrics(common.id)).rejects.toBeInstanceOf(PlatformAdminAccessDeniedError);
    expect((await listAdminCompanies(admin.user.id)).map((item) => item.name).sort()).toEqual(["Empresa access", "Empresa comum"]);
  });

  it("exige MFA ativo do administrador em todas as operações internas", async () => {
    const { user, company } = await setupAdmin("sem-mfa", "SUPER_ADMIN", { mfa: false });
    expect(await getPlatformAdminAccess(user.id)).toMatchObject({ role: "SUPER_ADMIN", mfaEnabled: false });
    await expect(getAdminBusinessMetrics(user.id)).rejects.toBeInstanceOf(PlatformAdminMfaRequiredError);
    await expect(listAdminCompanies(user.id)).rejects.toBeInstanceOf(PlatformAdminMfaRequiredError);
    await expect(listAdminSupport(user.id)).rejects.toBeInstanceOf(PlatformAdminMfaRequiredError);
    await expect(updateAdminSubscription(user.id, company.id, { status: "ACTIVE", planCode: "PRO", reason: "Teste" })).rejects.toBeInstanceOf(PlatformAdminMfaRequiredError);
    expect(await rootClient.adminAuditEvent.count()).toBe(0);

    await rootClient.user.update({ where: { id: user.id }, data: { mfaEnabledAt: new Date() } });
    expect(await getPlatformAdminAccess(user.id)).toMatchObject({ mfaEnabled: true });
    await expect(getAdminBusinessMetrics(user.id)).resolves.toBeTruthy();
  });

  it("o administrador vê só contagens: títulos, baixas e contas de clientes ficam fora do RLS", async () => {
    const admin = await setupAdmin("minimo");
    const owner = await registerUser({ email: `cliente.${randomUUID()}@teste.ax.finance`, name: "Cliente", password: "senha-forte-123" });
    const company = await createCompany(owner.id, { name: "Empresa do cliente" });
    const account = await createFinancialAccount(owner.id, company.id, { name: "Conta", type: "BANK", openingBalanceCents: 0, openingDate: "2026-09-01" });
    const category = await createCategory(owner.id, company.id, { name: "Receita", nature: "OPERATING_REVENUE" });
    const title = await createTitle(owner.id, company.id, { type: "RECEIVABLE", description: "Segredo comercial", categoryId: category.id, originalAmountCents: 9_999, competenceDate: "2026-09-01", dueDate: "2026-09-10" });
    await registerSettlement(owner.id, company.id, title.id, { financialAccountId: account.id, principalAmountCents: 9_999, effectiveDate: "2026-09-10" });

    const direct = await withUserContext(admin.user.id, async (tx) => ({
      titles: await tx.title.count(),
      settlements: await tx.settlement.count(),
      accounts: await tx.financialAccount.count(),
    }));
    expect(direct).toEqual({ titles: 0, settlements: 0, accounts: 0 });

    const row = (await listAdminCompanies(admin.user.id)).find((item) => item.name === "Empresa do cliente")!;
    expect(row._count).toMatchObject({ titles: 1, financialAccounts: 1, memberships: 1 });
    expect(await getAdminBusinessMetrics(admin.user.id)).toMatchObject({ totalCompanies: 2, activatedCompanies: 1 });

    const leaked = await withUserContext(owner.id, (tx) => tx.$queryRaw`SELECT company_id FROM app_admin_company_stats()`);
    expect(leaked).toEqual([]);
  });

  it("mede ativação/conversão e audita intervenção na assinatura", async () => {
    const { user, company } = await setupAdmin("metrics");
    const category = await createCategory(user.id, company.id, { name: "Receita", nature: "OPERATING_REVENUE" });
    await createTitle(user.id, company.id, { type: "RECEIVABLE", description: "Primeiro lançamento", categoryId: category.id, originalAmountCents: 1000, competenceDate: "2026-09-01", dueDate: "2026-09-10" });
    await updateAdminSubscription(user.id, company.id, { status: "ACTIVE", planCode: "PRO", currentPeriodEnd: "2026-10-31", reason: "Pagamento confirmado pelo provedor" });
    const metrics = await getAdminBusinessMetrics(user.id, new Date("2026-09-27T12:00:00Z"));
    expect(metrics).toMatchObject({ totalCompanies: 1, activatedCompanies: 1, paidCompanies: 1, activationRate: 1, conversionRate: 1 });
    expect(await rootClient.adminAuditEvent.findFirst({ where: { action: "SUBSCRIPTION_UPDATED" } })).toMatchObject({ targetId: company.id });
  });

  it("reprocessa jobs falhos de forma controlada e registra auditoria", async () => {
    const { user, company } = await setupAdmin("jobs", "OPERATIONS");
    const scheduled = await rootClient.scheduledJob.findFirstOrThrow({ where: { companyId: company.id } });
    await rootClient.scheduledJob.update({ where: { id: scheduled.id }, data: { attempts: 3, lastError: "Error:ECONNRESET" } });
    const account = await createFinancialAccount(user.id, company.id, { name: "Conta", type: "BANK", openingBalanceCents: 0, openingDate: "2026-09-01" });
    const batch = await rootClient.importBatch.create({ data: { companyId: company.id, financialAccountId: account.id, fileName: "falha.csv", status: "FAILED", failureCode: "ImportError" } });
    const importJob = await rootClient.importJob.create({ data: { companyId: company.id, importBatchId: batch.id, runAsUserId: user.id, status: "FAILED", attempts: 4, lastError: "ImportError" } });
    const dead = await rootClient.outboxEvent.create({ data: { type: "IMPORT_FAILED", status: "DEAD_LETTER", dedupKey: `dead:${randomUUID()}`, payloadEncrypted: "ciphertext", attempts: 5, lastError: "Error:SMTP" } });
    const diagnostics = await getAdminOperations(user.id);
    expect(diagnostics.scheduledJobs.some((item) => item.id === scheduled.id)).toBe(true);
    await reprocessScheduledJob(user.id, scheduled.id, { reason: "Falha transitória resolvida" });
    await reprocessImportJob(user.id, importJob.id, { reason: "Arquivo validado pelo suporte" });
    await reprocessDeadLetter(user.id, dead.id, { reason: "SMTP restabelecido" });
    expect(await rootClient.scheduledJob.findUnique({ where: { id: scheduled.id } })).toMatchObject({ attempts: 0, lastError: null, lockedAt: null });
    expect(await rootClient.importJob.findUnique({ where: { id: importJob.id } })).toMatchObject({ status: "PENDING", attempts: 0, lastError: null });
    expect(await rootClient.outboxEvent.findUnique({ where: { id: dead.id } })).toMatchObject({ status: "PENDING", attempts: 0, lastError: null });
    expect(await rootClient.adminAuditEvent.count()).toBe(3);
  });

  it("acompanha chamados e incidentes até a resolução", async () => {
    const { user, company } = await setupAdmin("support", "SUPPORT");
    const support = await createSupportCase(user.id, { companyId: company.id, subject: "Divergência no saldo", summary: "Cliente pediu análise", priority: "HIGH", assignedToUserId: user.id });
    await updateSupportCase(user.id, support.id, { status: "RESOLVED", priority: "HIGH", assignedToUserId: user.id, resolution: "Extrato reimportado" });
    const incident = await createIncident(user.id, { title: "Latência elevada", severity: "SEV2", publicMessage: "Investigando lentidão", internalSummary: "Banco sob carga" });
    await updateIncident(user.id, incident.id, { status: "RESOLVED", severity: "SEV2", publicMessage: "Operação normalizada", internalSummary: "Índice ajustado" });
    const result = await listAdminSupport(user.id);
    expect(result.cases[0]).toMatchObject({ status: "RESOLVED", resolution: "Extrato reimportado" });
    expect(result.incidents[0]).toMatchObject({ status: "RESOLVED", publicMessage: "Operação normalizada" });
  });
});
