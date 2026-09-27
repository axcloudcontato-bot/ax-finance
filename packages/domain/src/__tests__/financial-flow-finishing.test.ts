import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { registerUser } from "../identity/register";
import { createCompany } from "../companies/create-company";
import { createFinancialAccount } from "../financial-accounts/create-account";
import { archiveFinancialAccount, updateFinancialAccount } from "../financial-accounts/manage-account";
import { listFinancialAccountsWithBalance } from "../financial-accounts/account-balances";
import { createCategory } from "../categories/create-category";
import { createCostCenter } from "../cost-centers/cost-centers";
import { createTitle } from "../titles/create-title";
import { duplicateTitle } from "../titles/duplicate-title";
import { getTitle } from "../titles/get-title";
import { registerSettlement } from "../titles/register-settlement";
import { registerSettlementRefund } from "../titles/settlement-refunds";
import { replaceTitleAllocations } from "../titles/title-allocations";
import { applyTitleBatch, previewTitleBatch } from "../titles/title-batch";
import { updateTitle } from "../titles/update-title";
import { FinancialAccountHasBalanceError, TitleAllocationTotalInvalidError } from "../errors";
import { rootClient, resetDatabase } from "./test-db";

async function setup(label: string) {
  const user = await registerUser({ email: `${label}.${randomUUID()}@teste.ax.finance`, name: label, password: "senha-forte-123" });
  const company = await createCompany(user.id, { name: `Empresa ${label}` });
  const account = await createFinancialAccount(user.id, company.id, { name: "Principal", type: "BANK", openingBalanceCents: 0, openingDate: "2026-09-01" });
  const revenue = await createCategory(user.id, company.id, { name: "Receita", nature: "OPERATING_REVENUE" });
  const services = await createCategory(user.id, company.id, { name: "Serviços", nature: "OPERATING_REVENUE" });
  const center = await createCostCenter(user.id, company.id, { name: "Operação", code: "OP" });
  return { user, company, account, revenue, services, center };
}

beforeEach(resetDatabase);
afterAll(async () => rootClient.$disconnect());

describe("acabamento dos fluxos financeiros", () => {
  it("edita, duplica e rateia um título preservando a origem", async () => {
    const { user, company, revenue, services, center } = await setup("editar-ratear");
    const title = await createTitle(user.id, company.id, { type: "RECEIVABLE", description: "Projeto", categoryId: revenue.id, originalAmountCents: 10_000, competenceDate: "2026-09-01", dueDate: "2026-09-30" });
    await updateTitle(user.id, company.id, title.id, { description: "Projeto revisado", categoryId: revenue.id, costCenterId: center.id, originalAmountCents: 12_000, competenceDate: "2026-09-01", dueDate: "2026-10-05", notes: "Atualizado" });
    await expect(replaceTitleAllocations(user.id, company.id, title.id, { allocations: [{ categoryId: revenue.id, amountCents: 5_000 }, { categoryId: services.id, costCenterId: center.id, amountCents: 6_000 }] })).rejects.toBeInstanceOf(TitleAllocationTotalInvalidError);
    await replaceTitleAllocations(user.id, company.id, title.id, { allocations: [{ categoryId: revenue.id, amountCents: 5_000 }, { categoryId: services.id, costCenterId: center.id, amountCents: 7_000 }] });
    const copy = await duplicateTitle(user.id, company.id, title.id, { dueDate: "2026-11-05" });
    const detail = await getTitle(user.id, company.id, copy.id);
    expect(detail.description).toBe("Projeto revisado (cópia)");
    expect(detail.allocations).toHaveLength(2);
    expect(detail.status).toBe("OPEN");
  });

  it("registra devolução como caixa oposto e só arquiva conta zerada", async () => {
    const { user, company, account, revenue } = await setup("refund");
    const title = await createTitle(user.id, company.id, { type: "RECEIVABLE", description: "Venda", categoryId: revenue.id, originalAmountCents: 10_000, competenceDate: "2026-09-01", dueDate: "2026-09-10" });
    const settlement = await registerSettlement(user.id, company.id, title.id, { financialAccountId: account.id, principalAmountCents: 10_000, effectiveDate: "2026-09-10" });
    await expect(archiveFinancialAccount(user.id, company.id, account.id)).rejects.toBeInstanceOf(FinancialAccountHasBalanceError);
    await registerSettlementRefund(user.id, company.id, settlement.id, { financialAccountId: account.id, amountCents: 10_000, effectiveDate: "2026-09-11", reason: "Venda devolvida" });
    expect((await listFinancialAccountsWithBalance(user.id, company.id))[0]?.currentBalanceCents).toBe(BigInt(0));
    const archived = await archiveFinancialAccount(user.id, company.id, account.id);
    expect(archived.status).toBe("ARCHIVED");
  });

  it("edita os dados operacionais da conta", async () => {
    const { user, company, account } = await setup("account-edit");
    const updated = await updateFinancialAccount(user.id, company.id, account.id, { name: "Banco principal", type: "BANK", includedInAvailableTotal: false });
    expect(updated.name).toBe("Banco principal");
    expect(updated.includedInAvailableTotal).toBe(false);
  });

  it("pré-visualiza e confirma uma baixa integral atômica em lote", async () => {
    const { user, company, account, revenue } = await setup("batch");
    const first = await createTitle(user.id, company.id, { type: "RECEIVABLE", description: "A", categoryId: revenue.id, originalAmountCents: 4_000, competenceDate: "2026-09-01", dueDate: "2026-09-10" });
    const second = await createTitle(user.id, company.id, { type: "RECEIVABLE", description: "B", categoryId: revenue.id, originalAmountCents: 6_000, competenceDate: "2026-09-01", dueDate: "2026-09-11" });
    const input = { operation: "SETTLE_FULL" as const, titleIds: [first.id, second.id], financialAccountId: account.id, effectiveDate: "2026-09-12" };
    const preview = await previewTitleBatch(user.id, company.id, input);
    expect(preview.totalCents).toBe(BigInt(10_000));
    expect(preview.problems).toEqual([]);
    await applyTitleBatch(user.id, company.id, input);
    expect((await getTitle(user.id, company.id, first.id)).status).toBe("SETTLED");
    expect((await getTitle(user.id, company.id, second.id)).status).toBe("SETTLED");
  });
});
