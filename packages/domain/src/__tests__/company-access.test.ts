import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { registerUser } from "../identity/register";
import { createCompany } from "../companies/create-company";
import {
  acceptCompanyInvitation,
  createCompanyInvitation,
  getCompanyInvitationByToken,
  listCompanyMembers,
  revokeCompanyMember,
  transferCompanyOwnership,
  updateCompanyMemberAccess,
  updateCompanyMemberRole,
} from "../companies/members";
import { assertActiveMembership } from "../companies/assert-membership";
import { roleHasPermission } from "../companies/permissions";
import { createFinancialAccount } from "../financial-accounts/create-account";
import { listFinancialAccounts } from "../financial-accounts/list-accounts";
import {
  CompanyAccessDeniedError,
  CompanyInvitationInvalidError,
  CompanyMemberAlreadyActiveError,
  CompanyOwnerProtectedError,
  CompanyPermissionDeniedError,
} from "../errors";
import { rootClient, resetDatabase } from "./test-db";
import { decodeAccessChangedPayload, decodeCompanyInvitationPayload } from "../outbox/events";
import { listNotifications } from "../notifications/notifications";
import { createCostCenter, listCostCenters } from "../cost-centers/cost-centers";
import { createCategory } from "../categories/create-category";
import { createTitle } from "../titles/create-title";
import { listTitles } from "../titles/list-titles";
import { generateDueOccurrences } from "../recurrences/generate-due-occurrences";

function uniqueEmail(label: string) {
  return `${label}.${randomUUID()}@teste.ax.finance`;
}

beforeEach(async () => resetDatabase());
afterAll(async () => rootClient.$disconnect());

describe("convites e permissões por papel (FIN-014)", () => {
  it("mantém uma matriz explícita para todos os papéis do P0", () => {
    expect(roleHasPermission("OWNER", "MEMBERS_MANAGE")).toBe(true);
    expect(roleHasPermission("FINANCE_ADMIN", "REVERSAL")).toBe(true);
    expect(roleHasPermission("FINANCE_ADMIN", "MEMBERS_MANAGE")).toBe(false);
    expect(roleHasPermission("OPERATOR", "FINANCE_WRITE")).toBe(true);
    expect(roleHasPermission("OPERATOR", "EXPORT")).toBe(false);
    expect(roleHasPermission("ACCOUNTANT", "EXPORT")).toBe(true);
    expect(roleHasPermission("ACCOUNTANT", "FINANCE_WRITE")).toBe(false);
    expect(roleHasPermission("VIEWER", "FINANCE_READ")).toBe(true);
    expect(roleHasPermission("VIEWER", "FINANCE_WRITE")).toBe(false);
  });

  it("aceita convite apenas com o e-mail destinado e cria acesso com o papel escolhido", async () => {
    const owner = await registerUser({ email: uniqueEmail("owner"), name: "Dona", password: "senha-forte-123" });
    const invited = await registerUser({ email: uniqueEmail("invited"), name: "Convidada", password: "senha-forte-456" });
    const wrongUser = await registerUser({ email: uniqueEmail("wrong"), name: "Outra", password: "senha-forte-789" });
    const company = await createCompany(owner.id, { name: "Empresa convite" });

    const { rawToken } = await createCompanyInvitation(owner.id, company.id, {
      email: invited.email,
      role: "ACCOUNTANT",
    });
    const invitationEmail = await rootClient.outboxEvent.findFirstOrThrow({
      where: { type: "COMPANY_INVITATION" },
    });
    expect(invitationEmail.payloadEncrypted).not.toContain(rawToken);
    expect(decodeCompanyInvitationPayload(invitationEmail)).toMatchObject({
      to: invited.email,
      companyName: company.name,
      role: "ACCOUNTANT",
      rawToken,
    });
    const publicInvitation = await getCompanyInvitationByToken(invited.id, rawToken);
    expect(publicInvitation.companyName).toBe("Empresa convite");
    expect(publicInvitation.tokenHash).not.toBe(rawToken);

    await expect(
      createCompanyInvitation(owner.id, company.id, { email: owner.email, role: "VIEWER" })
    ).rejects.toBeInstanceOf(CompanyMemberAlreadyActiveError);

    await expect(acceptCompanyInvitation(wrongUser.id, rawToken)).rejects.toBeInstanceOf(
      CompanyInvitationInvalidError
    );

    const membership = await acceptCompanyInvitation(invited.id, rawToken);
    expect(membership.role).toBe("ACCOUNTANT");
    expect(membership.status).toBe("ACTIVE");
    expect((await listNotifications(owner.id, company.id))[0]).toMatchObject({
      type: "INVITATION_ACCEPTED",
    });
    const acceptedEmail = await rootClient.outboxEvent.findFirstOrThrow({
      where: { type: "ACCESS_CHANGED", dedupKey: { startsWith: "access-invitation-accepted:" } },
    });
    expect(decodeAccessChangedPayload(acceptedEmail)).toMatchObject({
      to: owner.email,
      kind: "INVITATION_ACCEPTED",
      targetName: invited.name,
    });
    await expect(getCompanyInvitationByToken(invited.id, rawToken)).rejects.toThrow();
  });

  it("aplica leitura, escrita e gestão de usuários conforme o papel", async () => {
    const owner = await registerUser({ email: uniqueEmail("owner"), name: "Dona", password: "senha-forte-123" });
    const viewer = await registerUser({ email: uniqueEmail("viewer"), name: "Consulta", password: "senha-forte-456" });
    const company = await createCompany(owner.id, { name: "Empresa permissões" });
    await createFinancialAccount(owner.id, company.id, {
      name: "Banco",
      type: "BANK",
      openingBalanceCents: 1000,
      openingDate: "2026-09-26",
    });
    const { rawToken } = await createCompanyInvitation(owner.id, company.id, { email: viewer.email, role: "VIEWER" });
    await acceptCompanyInvitation(viewer.id, rawToken);

    await expect(listFinancialAccounts(viewer.id, company.id)).resolves.toHaveLength(1);
    await expect(
      createFinancialAccount(viewer.id, company.id, {
        name: "Conta indevida",
        type: "CASH",
        openingBalanceCents: 0,
        openingDate: "2026-09-26",
      })
    ).rejects.toBeInstanceOf(CompanyPermissionDeniedError);
    await expect(listCompanyMembers(viewer.id, company.id)).rejects.toBeInstanceOf(
      CompanyPermissionDeniedError
    );

    const member = (await listCompanyMembers(owner.id, company.id)).find((item) => item.userId === viewer.id)!;
    await updateCompanyMemberRole(owner.id, company.id, member.id, { role: "OPERATOR" });
    expect((await listNotifications(viewer.id, company.id))[0]).toMatchObject({
      type: "ACCESS_ROLE_CHANGED",
    });
    const roleEmail = await rootClient.outboxEvent.findFirstOrThrow({
      where: { type: "ACCESS_CHANGED", dedupKey: { startsWith: "access-role-email:" } },
    });
    expect(decodeAccessChangedPayload(roleEmail)).toMatchObject({
      to: viewer.email,
      kind: "ROLE_CHANGED",
      role: "OPERATOR",
    });
    await expect(
      createFinancialAccount(viewer.id, company.id, {
        name: "Caixa permitido",
        type: "CASH",
        openingBalanceCents: 0,
        openingDate: "2026-09-26",
      })
    ).resolves.toMatchObject({ name: "Caixa permitido" });
  });

  it("revoga acesso imediatamente e protege o proprietário", async () => {
    const owner = await registerUser({ email: uniqueEmail("owner"), name: "Dona", password: "senha-forte-123" });
    const operator = await registerUser({ email: uniqueEmail("operator"), name: "Operador", password: "senha-forte-456" });
    const company = await createCompany(owner.id, { name: "Empresa revogação" });
    const { rawToken } = await createCompanyInvitation(owner.id, company.id, { email: operator.email, role: "OPERATOR" });
    await acceptCompanyInvitation(operator.id, rawToken);

    const members = await listCompanyMembers(owner.id, company.id);
    const ownerMembership = members.find((item) => item.userId === owner.id)!;
    const operatorMembership = members.find((item) => item.userId === operator.id)!;
    await expect(revokeCompanyMember(owner.id, company.id, ownerMembership.id)).rejects.toBeInstanceOf(
      CompanyOwnerProtectedError
    );

    await revokeCompanyMember(owner.id, company.id, operatorMembership.id);
    const revokedEmail = await rootClient.outboxEvent.findFirstOrThrow({
      where: { type: "ACCESS_CHANGED", dedupKey: { startsWith: "access-revoked:" } },
    });
    expect(decodeAccessChangedPayload(revokedEmail)).toMatchObject({
      to: operator.email,
      kind: "ACCESS_REVOKED",
    });
    await expect(assertActiveMembership(operator.id, company.id)).rejects.toBeInstanceOf(
      CompanyAccessDeniedError
    );
  });

  it("transfere a propriedade de forma atômica e mantém um único proprietário", async () => {
    const owner = await registerUser({ email: uniqueEmail("owner-transfer"), name: "Dona", password: "senha-forte-123" });
    const successor = await registerUser({ email: uniqueEmail("successor"), name: "Sucessora", password: "senha-forte-456" });
    const company = await createCompany(owner.id, { name: "Empresa sucessão" });
    const { rawToken } = await createCompanyInvitation(owner.id, company.id, { email: successor.email, role: "FINANCE_ADMIN" });
    await acceptCompanyInvitation(successor.id, rawToken);
    const target = (await listCompanyMembers(owner.id, company.id)).find((item) => item.userId === successor.id)!;

    await transferCompanyOwnership(owner.id, company.id, target.id);

    const memberships = await rootClient.membership.findMany({ where: { companyId: company.id, status: "ACTIVE" } });
    expect(memberships.filter((item) => item.role === "OWNER")).toEqual([
      expect.objectContaining({ userId: successor.id, accessScope: "ALL" }),
    ]);
    expect(memberships.find((item) => item.userId === owner.id)?.role).toBe("FINANCE_ADMIN");
    await expect(listCompanyMembers(owner.id, company.id)).rejects.toBeInstanceOf(CompanyPermissionDeniedError);
    await expect(listCompanyMembers(successor.id, company.id)).resolves.toHaveLength(2);
  });

  it("restringe um usuário às contas e centros de custo atribuídos", async () => {
    const owner = await registerUser({ email: uniqueEmail("owner-scope"), name: "Dona", password: "senha-forte-123" });
    const operator = await registerUser({ email: uniqueEmail("operator-scope"), name: "Operador", password: "senha-forte-456" });
    const company = await createCompany(owner.id, { name: "Empresa escopos" });
    const [accountA, accountB, centerA, centerB, category] = await Promise.all([
      createFinancialAccount(owner.id, company.id, { name: "Conta A", type: "BANK", openingBalanceCents: 0, openingDate: "2026-09-01" }),
      createFinancialAccount(owner.id, company.id, { name: "Conta B", type: "BANK", openingBalanceCents: 0, openingDate: "2026-09-01" }),
      createCostCenter(owner.id, company.id, { name: "Centro A" }),
      createCostCenter(owner.id, company.id, { name: "Centro B" }),
      createCategory(owner.id, company.id, { name: "Serviços", nature: "OPERATING_REVENUE" }),
    ]);
    await createTitle(owner.id, company.id, { type: "RECEIVABLE", description: "Visível", categoryId: category.id, costCenterId: centerA.id, originalAmountCents: 1000, competenceDate: "2026-09-01", dueDate: "2026-09-01" });
    await createTitle(owner.id, company.id, { type: "RECEIVABLE", description: "Oculto", categoryId: category.id, costCenterId: centerB.id, originalAmountCents: 1000, competenceDate: "2026-09-01", dueDate: "2026-09-01" });
    const { rawToken } = await createCompanyInvitation(owner.id, company.id, { email: operator.email, role: "OPERATOR" });
    await acceptCompanyInvitation(operator.id, rawToken);
    const membership = (await listCompanyMembers(owner.id, company.id)).find((item) => item.userId === operator.id)!;

    await updateCompanyMemberAccess(owner.id, company.id, membership.id, {
      accessScope: "RESTRICTED",
      financialAccountIds: [accountA.id],
      costCenterIds: [centerA.id],
    });

    expect((await listFinancialAccounts(operator.id, company.id)).map((item) => item.id)).toEqual([accountA.id]);
    expect((await listCostCenters(operator.id, company.id)).map((item) => item.id)).toEqual([centerA.id]);
    expect((await listTitles(operator.id, company.id)).map((item) => item.description)).toEqual(["Visível"]);
    expect(accountB.id).not.toBe(accountA.id);
  });
  it("jobs agendados seguem o proprietário atual e nunca ficam presos a quem perdeu o acesso", async () => {
    const owner = await registerUser({ email: uniqueEmail("job-owner"), name: "Dona", password: "senha-forte-123" });
    const successor = await registerUser({ email: uniqueEmail("job-successor"), name: "Sucessora", password: "senha-forte-456" });
    const company = await createCompany(owner.id, { name: "Empresa jobs" });
    const { rawToken } = await createCompanyInvitation(owner.id, company.id, { email: successor.email, role: "FINANCE_ADMIN" });
    await acceptCompanyInvitation(successor.id, rawToken);
    const runners = async () => (await rootClient.scheduledJob.findMany({ where: { companyId: company.id } })).map((job) => job.runAsUserId);

    expect(new Set(await runners())).toEqual(new Set([owner.id]));
    const successorMembership = (await listCompanyMembers(owner.id, company.id)).find((member) => member.userId === successor.id)!;
    await transferCompanyOwnership(owner.id, company.id, successorMembership.id);
    expect(new Set(await runners())).toEqual(new Set([successor.id]));

    // Dados anteriores à correção: jobs ainda apontando para o dono antigo.
    await rootClient.scheduledJob.updateMany({ where: { companyId: company.id }, data: { runAsUserId: owner.id } });
    const formerOwnerMembership = (await listCompanyMembers(successor.id, company.id)).find((member) => member.userId === owner.id)!;
    await revokeCompanyMember(successor.id, company.id, formerOwnerMembership.id);

    const after = await rootClient.scheduledJob.findMany({ where: { companyId: company.id } });
    expect(new Set(after.map((job) => job.runAsUserId))).toEqual(new Set([successor.id]));
    await expect(generateDueOccurrences(after[0]!.runAsUserId, company.id)).resolves.not.toThrow();
  });
});
