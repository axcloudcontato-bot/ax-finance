import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { registerUser } from "../identity/register";
import { createCompany } from "../companies/create-company";
import { createFinancialAccount } from "../financial-accounts/create-account";
import { createBalanceAdjustment } from "../financial-accounts/create-balance-adjustment";
import { createCategory } from "../categories/create-category";
import { createTitle } from "../titles/create-title";
import { createInstallmentPlan } from "../titles/create-installment-plan";
import { registerSettlement } from "../titles/register-settlement";
import { applyTitleBatch } from "../titles/title-batch";
import { createTransfer } from "../transfers/create-transfer";
import { FinancialAccountNotFoundError, IdempotencyConflictError } from "../errors";
import { rootClient, resetDatabase } from "./test-db";

async function setup() {
  const user = await registerUser({
    email: `idempotency.${randomUUID()}@teste.ax.finance`,
    name: "Idempotência",
    password: "senha-forte-123",
  });
  const company = await createCompany(user.id, { name: "Empresa Idempotente" });
  const account = await createFinancialAccount(user.id, company.id, {
    name: "Conta A",
    type: "BANK",
    openingBalanceCents: 10_000,
    openingDate: "2026-01-01",
  });
  const otherAccount = await createFinancialAccount(user.id, company.id, {
    name: "Conta B",
    type: "BANK",
    openingBalanceCents: 0,
    openingDate: "2026-01-01",
  });
  const category = await createCategory(user.id, company.id, {
    name: "Serviços",
    nature: "OPERATING_REVENUE",
  });
  return { user, company, account, otherAccount, category };
}

function titleInput(categoryId: string, idempotencyKey: string) {
  return {
    type: "RECEIVABLE" as const,
    description: "Mensalidade",
    categoryId,
    originalAmountCents: 10_000,
    competenceDate: "2026-01-01",
    dueDate: "2026-01-10",
    idempotencyKey,
  };
}

beforeEach(async () => resetDatabase());
afterAll(async () => rootClient.$disconnect());

describe("idempotência financeira", () => {
  it("devolve o mesmo título para reenvio sequencial e concorrente", async () => {
    const context = await setup();
    const sequentialKey = randomUUID();
    const first = await createTitle(context.user.id, context.company.id, titleInput(context.category.id, sequentialKey));
    const replay = await createTitle(context.user.id, context.company.id, titleInput(context.category.id, sequentialKey));
    expect(replay.id).toBe(first.id);

    const concurrentKey = randomUUID();
    const concurrent = await Promise.all([
      createTitle(context.user.id, context.company.id, titleInput(context.category.id, concurrentKey)),
      createTitle(context.user.id, context.company.id, titleInput(context.category.id, concurrentKey)),
    ]);
    expect(concurrent[0].id).toBe(concurrent[1].id);
    expect(await rootClient.title.count({ where: { companyId: context.company.id } })).toBe(2);
    expect(await rootClient.idempotencyRecord.count({ where: { companyId: context.company.id } })).toBe(2);
  });

  it("recusa reutilizar a mesma chave com conteúdo diferente", async () => {
    const context = await setup();
    const key = randomUUID();
    await createTitle(context.user.id, context.company.id, titleInput(context.category.id, key));
    await expect(createTitle(context.user.id, context.company.id, {
      ...titleInput(context.category.id, key),
      originalAmountCents: 20_000,
    })).rejects.toBeInstanceOf(IdempotencyConflictError);
    expect(await rootClient.title.count()).toBe(1);
  });

  it("não reserva a chave quando a operação financeira sofre rollback", async () => {
    const context = await setup();
    const key = randomUUID();
    await expect(createTitle(context.user.id, context.company.id, {
      ...titleInput(randomUUID(), key),
    })).rejects.toBeTruthy();
    expect(await rootClient.idempotencyRecord.count()).toBe(0);

    const recovered = await createTitle(
      context.user.id,
      context.company.id,
      titleInput(context.category.id, key)
    );
    expect(recovered.id).toBeTruthy();
    expect(await rootClient.idempotencyRecord.count()).toBe(1);
  });

  it("não duplica baixa nem evento de auditoria", async () => {
    const context = await setup();
    const title = await createTitle(context.user.id, context.company.id, titleInput(context.category.id, randomUUID()));
    const key = randomUUID();
    const input = {
      financialAccountId: context.account.id,
      principalAmountCents: 5_000,
      effectiveDate: "2026-01-05",
      idempotencyKey: key,
    };
    const [first, second] = await Promise.all([
      registerSettlement(context.user.id, context.company.id, title.id, input),
      registerSettlement(context.user.id, context.company.id, title.id, input),
    ]);
    expect(first.id).toBe(second.id);
    expect(await rootClient.settlement.count()).toBe(1);
    expect(await rootClient.auditEvent.count({ where: { eventType: "SETTLEMENT_REGISTERED" } })).toBe(1);
  });

  it("protege transferências e ajustes de saldo", async () => {
    const context = await setup();
    const transferKey = randomUUID();
    const transferInput = {
      fromAccountId: context.account.id,
      toAccountId: context.otherAccount.id,
      amountCents: 2_000,
      transferDate: "2026-01-05",
      idempotencyKey: transferKey,
    };
    const transfer = await createTransfer(context.user.id, context.company.id, transferInput);
    const transferReplay = await createTransfer(context.user.id, context.company.id, transferInput);
    expect(transferReplay.id).toBe(transfer.id);

    const adjustmentKey = randomUUID();
    const adjustmentInput = {
      financialAccountId: context.account.id,
      targetBalanceCents: 9_000,
      reason: "Conferência bancária",
      effectiveDate: "2026-01-06",
      idempotencyKey: adjustmentKey,
    };
    const adjustment = await createBalanceAdjustment(context.user.id, context.company.id, adjustmentInput);
    const adjustmentReplay = await createBalanceAdjustment(context.user.id, context.company.id, adjustmentInput);
    expect(adjustmentReplay.id).toBe(adjustment.id);
    expect(await rootClient.transfer.count()).toBe(1);
    expect(await rootClient.balanceAdjustment.count()).toBe(1);
  });

  it("reenvio de parcelamento devolve exatamente o mesmo grupo", async () => {
    const context = await setup();
    const key = randomUUID();
    const input = {
      type: "RECEIVABLE" as const,
      description: "Projeto parcelado",
      categoryId: context.category.id,
      totalAmountCents: 10_000,
      installmentCount: 3,
      firstDueDate: "2026-01-31",
      intervalMonths: 1,
      idempotencyKey: key,
    };
    const first = await createInstallmentPlan(context.user.id, context.company.id, input);
    const replay = await createInstallmentPlan(context.user.id, context.company.id, input);
    expect(replay.map(({ id }) => id)).toEqual(first.map(({ id }) => id));
    expect(await rootClient.title.count()).toBe(3);
  });
  it("lote de baixa: reenvio, concorrência e outra ordem dos títulos devolvem o mesmo resultado", async () => {
    const context = await setup();
    const first = await createTitle(context.user.id, context.company.id, titleInput(context.category.id, randomUUID()));
    const second = await createTitle(context.user.id, context.company.id, { ...titleInput(context.category.id, randomUUID()), originalAmountCents: 4_000 });
    const key = randomUUID();
    const input = { operation: "SETTLE_FULL" as const, titleIds: [first.id, second.id], financialAccountId: context.account.id, effectiveDate: "2026-01-12", idempotencyKey: key };

    const applied = await applyTitleBatch(context.user.id, context.company.id, input);
    expect(applied).toMatchObject({ count: 2, replayed: false });

    const replay = await applyTitleBatch(context.user.id, context.company.id, { ...input, titleIds: [second.id, first.id] });
    expect(replay).toMatchObject({ count: 2, replayed: true });
    expect(await rootClient.settlement.count()).toBe(2);

    const concurrentKey = randomUUID();
    const other = await createTitle(context.user.id, context.company.id, titleInput(context.category.id, randomUUID()));
    const concurrentInput = { ...input, titleIds: [other.id], idempotencyKey: concurrentKey };
    const concurrent = await Promise.all([
      applyTitleBatch(context.user.id, context.company.id, concurrentInput),
      applyTitleBatch(context.user.id, context.company.id, concurrentInput),
    ]);
    expect(concurrent.map((item) => item.replayed).sort()).toEqual([false, true]);
    expect(await rootClient.settlement.count()).toBe(3);
  });

  it("lote: mesma chave com dados diferentes é recusada", async () => {
    const context = await setup();
    const title = await createTitle(context.user.id, context.company.id, titleInput(context.category.id, randomUUID()));
    const key = randomUUID();
    const input = { operation: "SETTLE_FULL" as const, titleIds: [title.id], financialAccountId: context.account.id, effectiveDate: "2026-01-12", idempotencyKey: key };
    await applyTitleBatch(context.user.id, context.company.id, input);
    await expect(
      applyTitleBatch(context.user.id, context.company.id, { ...input, effectiveDate: "2026-01-20" })
    ).rejects.toBeInstanceOf(IdempotencyConflictError);
  });

  it("lote que falha desfaz também a chave: dá para corrigir e reenviar com a mesma chave", async () => {
    const context = await setup();
    const title = await createTitle(context.user.id, context.company.id, titleInput(context.category.id, randomUUID()));
    const key = randomUUID();
    const input = { operation: "SETTLE_FULL" as const, titleIds: [title.id], financialAccountId: context.account.id, effectiveDate: "2026-01-12", idempotencyKey: key };

    await expect(
      applyTitleBatch(context.user.id, context.company.id, { ...input, financialAccountId: randomUUID() })
    ).rejects.toBeInstanceOf(FinancialAccountNotFoundError);
    expect(await rootClient.idempotencyRecord.count()).toBe(1); // só a chave do createTitle

    await expect(applyTitleBatch(context.user.id, context.company.id, input)).resolves.toMatchObject({ count: 1, replayed: false });
  });
});
