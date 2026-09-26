import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { registerUser } from "../identity/register";
import { createCompany } from "../companies/create-company";
import { createFinancialAccount } from "../financial-accounts/create-account";
import { createCategory } from "../categories/create-category";
import { createTitle } from "../titles/create-title";
import { registerSettlement } from "../titles/register-settlement";
import { reverseSettlement } from "../titles/reverse-settlement";
import { cancelTitle } from "../titles/cancel-title";
import { createTransfer } from "../transfers/create-transfer";
import { reverseTransfer } from "../transfers/reverse-transfer";
import { listAuditEvents } from "../audit/list-audit-events";
import { rootClient, resetDatabase } from "./test-db";

function uniqueEmail(label: string) {
  return `${label}.${randomUUID()}@teste.ax.finance`;
}

async function setupCompanyWithTwoAccounts(label: string) {
  const user = await registerUser({
    email: uniqueEmail(label),
    name: `Usuária ${label}`,
    password: "senha-forte-123",
  });
  const company = await createCompany(user.id, { name: `Empresa ${label}` });
  const account = await createFinancialAccount(user.id, company.id, {
    name: "Conta A",
    type: "BANK",
    openingBalanceCents: 100_000,
    openingDate: "2026-01-01",
  });
  const secondAccount = await createFinancialAccount(user.id, company.id, {
    name: "Conta B",
    type: "BANK",
    openingBalanceCents: 0,
    openingDate: "2026-01-01",
  });
  const category = await createCategory(user.id, company.id, {
    name: "Serviços",
    nature: "OPERATING_REVENUE",
  });
  return { user, company, account, secondAccount, category };
}

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await rootClient.$disconnect();
});

describe("trilha de auditoria (Seção 18/19)", () => {
  it("registrar e estornar uma baixa gravam eventos na ordem certa, com o ator certo", async () => {
    const { user, company, account, category } = await setupCompanyWithTwoAccounts("baixa");

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

    await reverseSettlement(user.id, company.id, settlement.id, { reason: "Registrado por engano" });

    const events = await listAuditEvents(user.id, company.id, { resourceType: "Title", resourceId: title.id });

    expect(events).toHaveLength(2);
    expect(events.map((e) => e.eventType)).toEqual(["SETTLEMENT_REVERSED", "SETTLEMENT_REGISTERED"]);
    expect(events.every((e) => e.actorUserId === user.id)).toBe(true);
    expect(events.every((e) => e.actorName === user.name)).toBe(true);
    expect(events[0]?.summary).toBe("Registrado por engano");
  });

  it("cancelar um título grava evento com o motivo", async () => {
    const { user, company, category } = await setupCompanyWithTwoAccounts("cancel");

    const title = await createTitle(user.id, company.id, {
      type: "PAYABLE",
      description: "Compra cancelada",
      categoryId: category.id,
      originalAmountCents: 20_000,
      competenceDate: "2026-09-10",
      dueDate: "2026-09-10",
    });

    await cancelTitle(user.id, company.id, title.id, { reason: "Fornecedor cancelou o pedido" });

    const events = await listAuditEvents(user.id, company.id, { resourceType: "Title", resourceId: title.id });
    expect(events).toHaveLength(1);
    expect(events[0]?.eventType).toBe("TITLE_CANCELLED");
    expect(events[0]?.summary).toBe("Fornecedor cancelou o pedido");
  });

  it("criar e estornar uma transferência gravam eventos com resourceType Transfer", async () => {
    const { user, company, account, secondAccount } = await setupCompanyWithTwoAccounts("transfer");

    const transfer = await createTransfer(user.id, company.id, {
      fromAccountId: account.id,
      toAccountId: secondAccount.id,
      amountCents: 10_000,
      transferDate: "2026-09-10",
    });
    await reverseTransfer(user.id, company.id, transfer.id, { reason: "Valor errado" });

    const events = await listAuditEvents(user.id, company.id, { resourceType: "Transfer", resourceId: transfer.id });
    expect(events.map((e) => e.eventType)).toEqual(["TRANSFER_REVERSED", "TRANSFER_CREATED"]);
  });

  it("filtra por período", async () => {
    const { user, company, account, secondAccount } = await setupCompanyWithTwoAccounts("periodo");

    await createTransfer(user.id, company.id, {
      fromAccountId: account.id,
      toAccountId: secondAccount.id,
      amountCents: 5_000,
      transferDate: "2026-09-10",
    });

    const today = new Date().toISOString().slice(0, 10);
    const inRange = await listAuditEvents(user.id, company.id, { from: today, to: today });
    expect(inRange.length).toBeGreaterThan(0);

    const outOfRange = await listAuditEvents(user.id, company.id, { from: "2020-01-01", to: "2020-01-31" });
    expect(outOfRange).toHaveLength(0);
  });

  it("isola eventos entre empresas", async () => {
    const owner = await setupCompanyWithTwoAccounts("iso-owner");
    const outsider = await setupCompanyWithTwoAccounts("iso-outsider");

    await createTransfer(owner.user.id, owner.company.id, {
      fromAccountId: owner.account.id,
      toAccountId: owner.secondAccount.id,
      amountCents: 1_000,
      transferDate: "2026-09-10",
    });

    const eventsForOutsider = await listAuditEvents(outsider.user.id, outsider.company.id, {});
    expect(eventsForOutsider).toHaveLength(0);
  });
});
