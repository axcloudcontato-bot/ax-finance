import { randomUUID } from "node:crypto";
import { z } from "zod";
import { withCompanyContext, type TenantScopedClient } from "@ax-finance/db";
import { assertActiveMembership } from "../companies/assert-membership";
import { assertCompanyPermission } from "../companies/permissions";
import { recordAuditEvent } from "../audit/record-audit-event";
import { OPERATIONAL_ACCOUNT } from "../financial-accounts/operational";
import { computeAccountBalanceDeltas } from "../financial-accounts/account-balances";
import { addMonthsClamped } from "../titles/installment-dates";
import { listSavingsGoals } from "../savings-goals/savings-goals";
import { listCreditCards, summarizeCreditCardPortfolio } from "../credit-cards";
import { companyToday } from "../shared/today";
import { AssetNotFoundError, CategoryNotFoundError, CreditCardAccessRestrictedError, DebtHasPaymentsError, DebtNotFoundError, FinancialAccountNotFoundError } from "../errors";
import { amortizationSchedule, balanceAfter, type ScheduleRow } from "./amortization";

const ZERO = BigInt(0);
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const asDate = (value: string) => new Date(`${value}T00:00:00Z`);
const toDateString = (value: Date) => value.toISOString().slice(0, 10);

// ---------- Dívidas ----------

export const DEBT_KINDS = ["FINANCING", "LOAN", "OVERDRAFT", "OTHER"] as const;

export const createDebtInput = z.object({
  name: z.string().trim().min(1).max(120),
  kind: z.enum(DEBT_KINDS).default("FINANCING"),
  lender: z.string().trim().max(120).nullish(),
  principalCents: z.number().int().positive(),
  /** Juros ao mês em pontos-base (189 = 1,89% a.m.), de 0 a 20%. */
  monthlyRateBps: z.number().int().min(0).max(2000),
  installmentCount: z.number().int().min(1).max(600),
  /** Parcelas já pagas antes de cadastrar (não viram lançamento; só contam para o saldo devedor). */
  paidBeforeCount: z.number().int().min(0).default(0),
  /** Vencimento da 1ª parcela do contrato (as seguintes, todo mês no mesmo dia). */
  firstDueDate: dateOnly,
  amortization: z.enum(["PRICE", "SAC"]).default("PRICE"),
  categoryId: z.string().uuid(),
  expectedAccountId: z.string().uuid().nullish(),
}).refine((value) => value.paidBeforeCount < value.installmentCount, { message: "As parcelas já pagas precisam ser menos que o total.", path: ["paidBeforeCount"] });

/**
 * Cadastra a dívida e gera as parcelas que faltam pagar como saídas (um grupo de parcelas), com o
 * valor de cada uma pela tabela Price ou SAC. Pagar uma parcela é registrar a baixa da saída, como
 * qualquer conta; o saldo devedor acompanha as parcelas quitadas.
 */
export async function createDebt(userId: string, companyId: string, rawInput: unknown) {
  const data = createDebtInput.parse(rawInput);
  await assertCompanyPermission(userId, companyId, "FINANCE_WRITE");
  return withCompanyContext(userId, companyId, async (tx) => {
    const category = await tx.category.findFirst({ where: { id: data.categoryId, companyId, status: "ACTIVE", nature: { not: "OPERATING_REVENUE" } } });
    if (!category) throw new CategoryNotFoundError();
    if (data.expectedAccountId && !(await tx.financialAccount.findFirst({ where: { id: data.expectedAccountId, companyId, status: "ACTIVE", ...OPERATIONAL_ACCOUNT } }))) throw new FinancialAccountNotFoundError();

    const schedule = amortizationSchedule({ principalCents: BigInt(data.principalCents), monthlyRateBps: data.monthlyRateBps, count: data.installmentCount, system: data.amortization });
    const installmentGroupId = randomUUID();
    const debt = await tx.debt.create({
      data: {
        companyId,
        name: data.name,
        kind: data.kind,
        lender: data.lender || null,
        principalCents: BigInt(data.principalCents),
        monthlyRateBps: data.monthlyRateBps,
        installmentCount: data.installmentCount,
        paidBeforeCount: data.paidBeforeCount,
        firstDueDate: asDate(data.firstDueDate),
        amortization: data.amortization,
        installmentGroupId,
        categoryId: data.categoryId,
        expectedAccountId: data.expectedAccountId ?? null,
        createdByUserId: userId,
      },
    });
    for (const row of schedule) {
      if (row.number <= data.paidBeforeCount) continue;
      const dueDate = asDate(addMonthsClamped(data.firstDueDate, row.number - 1));
      await tx.title.create({
        data: {
          companyId,
          type: "PAYABLE",
          description: `${data.name} — parcela ${row.number}/${data.installmentCount}`,
          categoryId: data.categoryId,
          originalAmountCents: row.paymentCents,
          competenceDate: dueDate,
          dueDate,
          expectedAccountId: data.expectedAccountId ?? null,
          installmentGroupId,
          installmentNumber: row.number,
          installmentCount: data.installmentCount,
          notes: `Juros ${(Number(row.interestCents) / 100).toFixed(2).replace(".", ",")} · amortização ${(Number(row.amortizationCents) / 100).toFixed(2).replace(".", ",")}${data.lender ? ` · ${data.lender}` : ""}`,
        },
      });
    }
    await recordAuditEvent(tx, {
      companyId, actorUserId: userId, eventType: "DEBT_CREATED", resourceType: "Debt", resourceId: debt.id,
      summary: `Dívida "${debt.name}" cadastrada (${data.installmentCount - data.paidBeforeCount} parcelas lançadas)`,
      metadata: { principalCents: data.principalCents, installments: data.installmentCount },
    });
    return debt;
  });
}

type DebtRecord = NonNullable<Awaited<ReturnType<TenantScopedClient["debt"]["findFirst"]>>>;

async function debtView(tx: TenantScopedClient, companyId: string, debt: DebtRecord, today: string) {
  const titles = await tx.title.findMany({
    where: { companyId, installmentGroupId: debt.installmentGroupId, deletedAt: null },
    select: { id: true, installmentNumber: true, dueDate: true, status: true, originalAmountCents: true },
    orderBy: { installmentNumber: "asc" },
  });
  const schedule = amortizationSchedule({ principalCents: debt.principalCents, monthlyRateBps: debt.monthlyRateBps, count: debt.installmentCount, system: debt.amortization });
  const byNumber = new Map(titles.map((title) => [title.installmentNumber, title]));
  const settled = titles.filter((title) => title.status === "SETTLED").length;
  const paid = Math.min(debt.installmentCount, debt.paidBeforeCount + settled);
  const balanceCents = balanceAfter(schedule, debt.principalCents, paid);
  const remainingRows = schedule.slice(paid);
  const next = titles.find((title) => title.status !== "SETTLED" && title.status !== "CANCELLED");
  const rows = schedule.map((row: ScheduleRow) => {
    const title = byNumber.get(row.number);
    return {
      ...row,
      dueDate: addMonthsClamped(toDateString(debt.firstDueDate), row.number - 1),
      titleId: title?.id ?? null,
      state: row.number <= debt.paidBeforeCount ? ("PAID_BEFORE" as const) : title?.status === "SETTLED" ? ("PAID" as const) : !title ? ("REMOVED" as const) : title.dueDate < asDate(today) ? ("OVERDUE" as const) : ("OPEN" as const),
    };
  });
  return {
    ...debt,
    paidCount: paid,
    balanceCents,
    remainingInterestCents: remainingRows.reduce((sum, row) => sum + row.interestCents, ZERO),
    remainingPaymentsCents: remainingRows.reduce((sum, row) => sum + row.paymentCents, ZERO),
    totalInterestCents: schedule.reduce((sum, row) => sum + row.interestCents, ZERO),
    paidPercent: debt.principalCents > ZERO ? Number(((debt.principalCents - balanceCents) * BigInt(1000)) / debt.principalCents) / 10 : 0,
    nextInstallment: next ? { titleId: next.id, number: next.installmentNumber, dueDate: next.dueDate, amountCents: next.originalAmountCents, overdue: next.dueDate < asDate(today) } : null,
    overdueCount: rows.filter((row) => row.state === "OVERDUE").length,
    rows,
  };
}

export async function listDebts(userId: string, companyId: string, options: { includeArchived?: boolean } = {}) {
  await assertActiveMembership(userId, companyId);
  return withCompanyContext(userId, companyId, async (tx) => {
    const today = await companyToday(tx, companyId);
    const debts = await tx.debt.findMany({ where: { companyId, ...(options.includeArchived ? {} : { status: "ACTIVE" }) }, orderBy: { createdAt: "asc" } });
    const views = [];
    for (const debt of debts) views.push(await debtView(tx, companyId, debt, today));
    return {
      today,
      debts: views,
      totals: {
        balanceCents: views.filter((view) => view.status === "ACTIVE").reduce((sum, view) => sum + view.balanceCents, ZERO),
        remainingInterestCents: views.filter((view) => view.status === "ACTIVE").reduce((sum, view) => sum + view.remainingInterestCents, ZERO),
        monthlyCents: views.filter((view) => view.status === "ACTIVE" && view.nextInstallment).reduce((sum, view) => sum + view.nextInstallment!.amountCents, ZERO),
      },
    };
  });
}

export async function getDebt(userId: string, companyId: string, debtId: string) {
  await assertActiveMembership(userId, companyId);
  return withCompanyContext(userId, companyId, async (tx) => {
    const debt = await tx.debt.findFirst({ where: { id: debtId, companyId } });
    if (!debt) throw new DebtNotFoundError();
    const category = await tx.category.findFirst({ where: { id: debt.categoryId, companyId }, select: { name: true } });
    return { ...(await debtView(tx, companyId, debt, await companyToday(tx, companyId))), categoryName: category?.name ?? "" };
  });
}

/** Arquivar tira a dívida do patrimônio e da lista; as parcelas lançadas continuam nas saídas. */
export async function setDebtArchived(userId: string, companyId: string, debtId: string, archived: boolean) {
  await assertCompanyPermission(userId, companyId, "FINANCE_WRITE");
  return withCompanyContext(userId, companyId, async (tx) => {
    const debt = await tx.debt.findFirst({ where: { id: debtId, companyId } });
    if (!debt) throw new DebtNotFoundError();
    await tx.debt.update({ where: { id: debtId }, data: { status: archived ? "ARCHIVED" : "ACTIVE" } });
    await recordAuditEvent(tx, { companyId, actorUserId: userId, eventType: archived ? "DEBT_ARCHIVED" : "DEBT_REACTIVATED", resourceType: "Debt", resourceId: debtId, summary: `Dívida "${debt.name}" ${archived ? "arquivada" : "reativada"}` });
  });
}

/** Excluir só vale se nenhuma parcela lançada foi paga: tira a dívida e as parcelas em aberto (exclusão lógica). */
export async function deleteDebt(userId: string, companyId: string, debtId: string) {
  await assertCompanyPermission(userId, companyId, "FINANCE_WRITE");
  return withCompanyContext(userId, companyId, async (tx) => {
    const debt = await tx.debt.findFirst({ where: { id: debtId, companyId } });
    if (!debt) throw new DebtNotFoundError();
    const titles = await tx.title.findMany({ where: { companyId, installmentGroupId: debt.installmentGroupId, deletedAt: null }, select: { id: true } });
    const payments = await tx.settlement.count({ where: { companyId, titleId: { in: titles.map((title) => title.id) } } });
    if (payments > 0) throw new DebtHasPaymentsError();
    await tx.title.updateMany({ where: { id: { in: titles.map((title) => title.id) } }, data: { deletedAt: new Date(), deletedByUserId: userId, deleteReason: `Dívida "${debt.name}" excluída` } });
    await tx.debt.delete({ where: { id: debtId } });
    await recordAuditEvent(tx, { companyId, actorUserId: userId, eventType: "DEBT_DELETED", resourceType: "Debt", resourceId: debtId, summary: `Dívida "${debt.name}" excluída com ${titles.length} parcelas em aberto` });
  });
}

// ---------- Bens e investimentos ----------

export const ASSET_KINDS = ["INVESTMENT", "PROPERTY", "VEHICLE", "OTHER"] as const;

export const assetInput = z.object({
  name: z.string().trim().min(1).max(120),
  kind: z.enum(ASSET_KINDS).default("INVESTMENT"),
  valueCents: z.number().int().min(0),
  valuedAt: dateOnly,
  notes: z.string().trim().max(500).nullish(),
});

export async function listAssets(userId: string, companyId: string) {
  await assertActiveMembership(userId, companyId);
  return withCompanyContext(userId, companyId, (tx) => tx.asset.findMany({ where: { companyId }, orderBy: [{ kind: "asc" }, { name: "asc" }] }));
}

export async function createAsset(userId: string, companyId: string, rawInput: unknown) {
  const data = assetInput.parse(rawInput);
  await assertCompanyPermission(userId, companyId, "FINANCE_WRITE");
  return withCompanyContext(userId, companyId, async (tx) => {
    const asset = await tx.asset.create({ data: { companyId, name: data.name, kind: data.kind, valueCents: BigInt(data.valueCents), valuedAt: asDate(data.valuedAt), notes: data.notes || null, createdByUserId: userId } });
    await recordAuditEvent(tx, { companyId, actorUserId: userId, eventType: "ASSET_CREATED", resourceType: "Asset", resourceId: asset.id, summary: `Bem "${asset.name}" cadastrado`, metadata: { valueCents: data.valueCents } });
    return asset;
  });
}

export async function updateAsset(userId: string, companyId: string, assetId: string, rawInput: unknown) {
  const data = assetInput.parse(rawInput);
  await assertCompanyPermission(userId, companyId, "FINANCE_WRITE");
  return withCompanyContext(userId, companyId, async (tx) => {
    const existing = await tx.asset.findFirst({ where: { id: assetId, companyId } });
    if (!existing) throw new AssetNotFoundError();
    const asset = await tx.asset.update({ where: { id: assetId }, data: { name: data.name, kind: data.kind, valueCents: BigInt(data.valueCents), valuedAt: asDate(data.valuedAt), notes: data.notes || null } });
    await recordAuditEvent(tx, { companyId, actorUserId: userId, eventType: "ASSET_UPDATED", resourceType: "Asset", resourceId: asset.id, summary: `Bem "${asset.name}" atualizado`, metadata: { previousValueCents: existing.valueCents.toString(), valueCents: data.valueCents } });
    return asset;
  });
}

export async function deleteAsset(userId: string, companyId: string, assetId: string) {
  await assertCompanyPermission(userId, companyId, "FINANCE_WRITE");
  return withCompanyContext(userId, companyId, async (tx) => {
    const existing = await tx.asset.findFirst({ where: { id: assetId, companyId } });
    if (!existing) throw new AssetNotFoundError();
    await tx.asset.delete({ where: { id: assetId } });
    await recordAuditEvent(tx, { companyId, actorUserId: userId, eventType: "ASSET_DELETED", resourceType: "Asset", resourceId: assetId, summary: `Bem "${existing.name}" excluído` });
  });
}

// ---------- Patrimônio ----------

/**
 * Patrimônio líquido = o que se tem (saldo das contas, cofrinhos, bens e investimentos) menos o que se
 * deve (saldo devedor das dívidas e o que falta pagar nos cartões, incluindo parcelas futuras).
 * Contas a pagar comuns não entram: são gastos do dia a dia, não dívida (as parcelas das dívidas
 * cadastradas já estão no saldo devedor).
 */
export async function getNetWorth(userId: string, companyId: string) {
  await assertActiveMembership(userId, companyId);
  const [base, savings, debts, assets, cards] = await Promise.all([
    withCompanyContext(userId, companyId, async (tx) => {
      const today = await companyToday(tx, companyId);
      const [accounts, deltas] = await Promise.all([
        tx.financialAccount.findMany({ where: { companyId, status: "ACTIVE", ...OPERATIONAL_ACCOUNT }, select: { id: true, name: true, openingBalanceCents: true, openingDate: true } }),
        computeAccountBalanceDeltas(tx, companyId, asDate(today)),
      ]);
      return {
        today,
        accounts: accounts
          .filter((account) => toDateString(account.openingDate) <= today)
          .map((account) => ({ id: account.id, name: account.name, balanceCents: account.openingBalanceCents + (deltas.get(account.id) ?? ZERO) })),
      };
    }),
    listSavingsGoals(userId, companyId),
    listDebts(userId, companyId),
    listAssets(userId, companyId),
    listCreditCards(userId, companyId, { includeArchived: true }).catch((error) => {
      if (error instanceof CreditCardAccessRestrictedError) return null;
      throw error;
    }),
  ]);
  const accountsCents = base.accounts.reduce((sum, account) => sum + account.balanceCents, ZERO);
  const assetsCents = assets.reduce((sum, asset) => sum + asset.valueCents, ZERO);
  const cardDebtCents = cards ? summarizeCreditCardPortfolio(cards, base.today).totalDebtCents : ZERO;
  const totalAssets = accountsCents + savings.totals.savedCents + assetsCents;
  const totalLiabilities = debts.totals.balanceCents + cardDebtCents;
  return {
    today: base.today,
    accounts: base.accounts,
    accountsCents,
    savingsCents: savings.totals.savedCents,
    assets,
    assetsCents,
    debts: debts.debts.map((debt) => ({ id: debt.id, name: debt.name, balanceCents: debt.balanceCents })),
    debtsCents: debts.totals.balanceCents,
    cardDebtCents,
    cardsAvailable: cards !== null,
    totalAssetsCents: totalAssets,
    totalLiabilitiesCents: totalLiabilities,
    netWorthCents: totalAssets - totalLiabilities,
  };
}
