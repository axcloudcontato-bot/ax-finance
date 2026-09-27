import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { registerUser } from "../identity/register";
import { createCompany } from "../companies/create-company";
import { createFinancialAccount } from "../financial-accounts/create-account";
import { createCategory } from "../categories/create-category";
import { createTitle } from "../titles/create-title";
import { registerSettlement } from "../titles/register-settlement";
import { createInstallmentPlan } from "../titles/create-installment-plan";
import { deleteTitle } from "../titles/delete-title";
import { deleteInstallmentPlan } from "../titles/delete-installment-plan";
import { getTitle } from "../titles/get-title";
import { listTitles } from "../titles/list-titles";
import { importBankStatement } from "../reconciliation/import-bank-statement";
import { listBankStatementLines } from "../reconciliation/list-bank-statement-lines";
import { reconcileBankStatementLine } from "../reconciliation/reconcile-bank-statement-line";
import { closePeriod } from "../closures/close-period";
import { listAuditEvents } from "../audit/list-audit-events";
import { TitleNotFoundError, InstallmentGroupNotFoundError, PeriodClosedError } from "../errors";
import { rootClient, resetDatabase } from "./test-db";

function uniqueEmail(label: string) {
  return `${label}.${randomUUID()}@teste.ax.finance`;
}

async function setupCompany(label: string) {
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
    name: "Serviços",
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

describe("soft delete de título (inclusive com baixa)", () => {
  it("oculta um título sem apagar seu histórico", async () => {
    const { user, company, category } = await setupCompany("del-simples");

    const title = await createTitle(user.id, company.id, {
      type: "RECEIVABLE",
      description: "Título de teste",
      categoryId: category.id,
      originalAmountCents: 10_000,
      competenceDate: "2026-09-10",
      dueDate: "2026-09-10",
    });

    await deleteTitle(user.id, company.id, title.id, { reason: "Lançado por engano" });

    await expect(getTitle(user.id, company.id, title.id)).rejects.toBeInstanceOf(TitleNotFoundError);

    const events = await listAuditEvents(user.id, company.id, { resourceType: "Title", resourceId: title.id });
    expect(events.map((e) => e.eventType)).toEqual(["TITLE_SOFT_DELETED"]);
    expect(events[0]?.summary).toBe("Lançado por engano");
    expect(await rootClient.title.findUnique({ where: { id: title.id } })).toMatchObject({
      deleteReason: "Lançado por engano",
    });
  });

  it("preserva baixa e conciliação de um título removido", async () => {
    const { user, company, account, category } = await setupCompany("del-com-baixa");

    const title = await createTitle(user.id, company.id, {
      type: "RECEIVABLE",
      description: "Serviço prestado",
      categoryId: category.id,
      originalAmountCents: 50_000,
      competenceDate: "2026-09-10",
      dueDate: "2026-09-10",
    });
    const settlement = await registerSettlement(user.id, company.id, title.id, {
      financialAccountId: account.id,
      principalAmountCents: 50_000,
      effectiveDate: "2026-09-10",
    });

    await importBankStatement(user.id, company.id, {
      financialAccountId: account.id,
      fileName: "extrato.csv",
      csvContent: ["data,descricao,valor", "10/09/2026,Recebimento,500,00"].join("\n"),
    });
    const [line] = await listBankStatementLines(user.id, company.id, { financialAccountId: account.id });
    await reconcileBankStatementLine(user.id, company.id, line!.id, { settlementId: settlement.id });

    await deleteTitle(user.id, company.id, title.id, { reason: "Duplicado, apagar tudo" });

    await expect(getTitle(user.id, company.id, title.id)).rejects.toBeInstanceOf(TitleNotFoundError);

    const [lineAfter] = await listBankStatementLines(user.id, company.id, { financialAccountId: account.id });
    expect(lineAfter?.status).toBe("RECONCILED");
    expect(lineAfter?.reconciledSettlementId).toBe(settlement.id);
    expect(await rootClient.settlement.count({ where: { titleId: title.id } })).toBe(1);
  });

  it("bloqueia excluir título/baixa de período fechado", async () => {
    const { user, company, account, category } = await setupCompany("del-fechado");

    const title = await createTitle(user.id, company.id, {
      type: "RECEIVABLE",
      description: "Serviço de setembro",
      categoryId: category.id,
      originalAmountCents: 50_000,
      competenceDate: "2026-09-10",
      dueDate: "2026-09-10",
    });
    await registerSettlement(user.id, company.id, title.id, {
      financialAccountId: account.id,
      principalAmountCents: 50_000,
      effectiveDate: "2026-09-10",
    });

    await closePeriod(user.id, company.id, { period: "2026-09" });

    await expect(
      deleteTitle(user.id, company.id, title.id, { reason: "Tentando driblar o fechamento" })
    ).rejects.toBeInstanceOf(PeriodClosedError);
  });

  it("título inexistente lança TitleNotFoundError", async () => {
    const { user, company } = await setupCompany("del-inexistente");

    await expect(
      deleteTitle(user.id, company.id, randomUUID(), { reason: "Qualquer" })
    ).rejects.toBeInstanceOf(TitleNotFoundError);
  });

  it("isola exclusão entre empresas", async () => {
    const owner = await setupCompany("del-iso-owner");
    const outsider = await setupCompany("del-iso-outsider");

    const title = await createTitle(owner.user.id, owner.company.id, {
      type: "RECEIVABLE",
      description: "Título do dono",
      categoryId: owner.category.id,
      originalAmountCents: 10_000,
      competenceDate: "2026-09-10",
      dueDate: "2026-09-10",
    });

    await expect(
      deleteTitle(outsider.user.id, outsider.company.id, title.id, { reason: "Tentando de fora" })
    ).rejects.toBeInstanceOf(TitleNotFoundError);
  });
});

describe("excluir parcelamento em massa", () => {
  it("exclui todas as parcelas de um parcelamento", async () => {
    const { user, company, category } = await setupCompany("del-parcelas");

    const titles = await createInstallmentPlan(user.id, company.id, {
      type: "PAYABLE",
      description: "Compra parcelada",
      categoryId: category.id,
      totalAmountCents: 30_000,
      installmentCount: 3,
      firstDueDate: "2026-10-05",
    });
    const groupId = titles[0]!.installmentGroupId!;

    const result = await deleteInstallmentPlan(user.id, company.id, groupId, {
      reason: "Parcelamento cadastrado errado",
    });
    expect(result.deletedCount).toBe(3);

    const remaining = await listTitles(user.id, company.id, { type: "PAYABLE" });
    expect(remaining.filter((t) => t.installmentGroupId === groupId)).toHaveLength(0);

    const events = await listAuditEvents(user.id, company.id, {
      resourceType: "InstallmentGroup",
      resourceId: groupId,
    });
    expect(events.map((e) => e.eventType)).toEqual(["INSTALLMENT_PLAN_SOFT_DELETED"]);
    expect(await rootClient.title.count({ where: { installmentGroupId: groupId, deletedAt: { not: null } } })).toBe(3);
  });

  it("grupo inexistente lança InstallmentGroupNotFoundError", async () => {
    const { user, company } = await setupCompany("del-parcelas-inexistente");

    await expect(
      deleteInstallmentPlan(user.id, company.id, randomUUID(), { reason: "Qualquer" })
    ).rejects.toBeInstanceOf(InstallmentGroupNotFoundError);
  });
});
