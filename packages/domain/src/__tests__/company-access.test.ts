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
    await expect(assertActiveMembership(operator.id, company.id)).rejects.toBeInstanceOf(
      CompanyAccessDeniedError
    );
  });
});
