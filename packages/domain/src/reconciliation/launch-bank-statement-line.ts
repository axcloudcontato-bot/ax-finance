import { z } from "zod";
import { withCompanyContext, type TenantScopedClient } from "@ax-finance/db";
import { assertCompanyPermission } from "../companies/permissions";
import { assertCompanyPlanFeature } from "../subscriptions/plan-features";
import { recordAuditEvent } from "../audit/record-audit-event";
import { insertTitleInTx } from "../titles/create-title";
import { registerSettlementInTx } from "../titles/register-settlement";
import { findMatchingRuleInTx } from "../categories/category-rules";
import { BankStatementLineAlreadyProcessedError, BankStatementLineNotFoundError, DomainError } from "../errors";

export const launchBankStatementLineInput = z.object({
  description: z.string().trim().min(1).max(500).optional(),
  categoryId: z.string().uuid(),
  costCenterId: z.string().uuid().nullish(),
  partyId: z.string().uuid().nullish(),
});

/**
 * Cria o lançamento que faltava para uma linha do extrato: título (entrada se a linha é crédito, saída
 * se é débito) com competência e vencimento na data da linha, baixa total na conta da linha e a
 * conciliação, tudo na mesma transação. É o "Lançar e conciliar" da tela de conciliação.
 */
async function launchInTx(
  tx: TenantScopedClient,
  userId: string,
  companyId: string,
  lineId: string,
  data: z.infer<typeof launchBankStatementLineInput>,
  ruleId: string | null,
) {
  await tx.$queryRaw`SELECT "id" FROM "bank_statement_lines" WHERE "id" = ${lineId} AND "company_id" = ${companyId} FOR UPDATE`;
  const line = await tx.bankStatementLine.findFirst({ where: { id: lineId, companyId } });
  if (!line) throw new BankStatementLineNotFoundError();
  if (line.status !== "PENDING") throw new BankStatementLineAlreadyProcessedError();

  const type = line.amountCents > BigInt(0) ? "RECEIVABLE" : "PAYABLE";
  const amount = line.amountCents > BigInt(0) ? line.amountCents : -line.amountCents;
  const title = await insertTitleInTx(tx, userId, companyId, {
    type,
    description: data.description || line.description,
    categoryId: data.categoryId,
    costCenterId: data.costCenterId ?? undefined,
    partyId: data.partyId ?? undefined,
    originalAmountCents: Number(amount),
    currency: "BRL",
    competenceDate: line.lineDate,
    dueDate: line.lineDate,
    expectedAccountId: line.financialAccountId,
    notes: "Lançado a partir do extrato bancário.",
  });
  const settlement = await registerSettlementInTx(tx, userId, companyId, title.id, {
    financialAccountId: line.financialAccountId,
    principalAmountCents: Number(amount),
    discountCents: 0,
    interestPenaltyCents: 0,
    feesCents: 0,
    effectiveDate: line.lineDate,
  });
  await tx.bankStatementLine.update({ where: { id: line.id }, data: { status: "RECONCILED", reconciledSettlementId: settlement.id, ignoreReason: null } });
  if (ruleId) await tx.categoryRule.update({ where: { id: ruleId }, data: { timesApplied: { increment: 1 } } });
  await recordAuditEvent(tx, {
    companyId, actorUserId: userId, eventType: "BANK_LINE_LAUNCHED", resourceType: "Title", resourceId: title.id,
    summary: `${type === "RECEIVABLE" ? "Entrada" : "Saída"} "${title.description}" lançada e conciliada pelo extrato`,
    metadata: { lineId: line.id, ruleId },
  });
  return { title, settlement };
}

export async function launchBankStatementLine(userId: string, companyId: string, lineId: string, rawInput: unknown) {
  const data = launchBankStatementLineInput.parse(rawInput);
  await assertCompanyPermission(userId, companyId, "FINANCE_WRITE");
  await assertCompanyPlanFeature(userId, companyId, "BANK_RECONCILIATION");
  return withCompanyContext(userId, companyId, async (tx) => {
    const line = await tx.bankStatementLine.findFirst({ where: { id: lineId, companyId }, select: { description: true, amountCents: true } });
    const rule = line ? await findMatchingRuleInTx(tx, companyId, line.description, line.amountCents > BigInt(0) ? "RECEIVABLE" : "PAYABLE") : null;
    // a regra só conta como usada se a pessoa manteve a categoria que ela sugeriu
    return launchInTx(tx, userId, companyId, lineId, data, rule && rule.categoryId === data.categoryId ? rule.id : null);
  });
}

/**
 * "Lançar todas pelas regras": cada linha pendente da conta (no período) que casa com uma regra vira
 * lançamento conciliado. Cada linha roda na sua transação: uma que falha (período fechado, categoria
 * arquivada) fica pendente e as outras seguem.
 */
export async function launchBankStatementLinesByRules(userId: string, companyId: string, input: { financialAccountId: string; from?: string; to?: string }) {
  await assertCompanyPermission(userId, companyId, "FINANCE_WRITE");
  await assertCompanyPlanFeature(userId, companyId, "BANK_RECONCILIATION");
  const lines = await withCompanyContext(userId, companyId, (tx) => tx.bankStatementLine.findMany({
    where: {
      companyId,
      financialAccountId: input.financialAccountId,
      status: "PENDING",
      ...(input.from || input.to ? { lineDate: { ...(input.from ? { gte: new Date(`${input.from}T00:00:00Z`) } : {}), ...(input.to ? { lte: new Date(`${input.to}T00:00:00Z`) } : {}) } } : {}),
    },
    select: { id: true },
    orderBy: { lineDate: "asc" },
  }));

  let launched = 0;
  let failed = 0;
  for (const { id } of lines) {
    try {
      const done = await withCompanyContext(userId, companyId, async (tx) => {
        const line = await tx.bankStatementLine.findFirst({ where: { id, companyId }, select: { description: true, amountCents: true } });
        if (!line) return false;
        const rule = await findMatchingRuleInTx(tx, companyId, line.description, line.amountCents > BigInt(0) ? "RECEIVABLE" : "PAYABLE");
        if (!rule) return false;
        await launchInTx(tx, userId, companyId, id, { categoryId: rule.categoryId, costCenterId: rule.costCenterId, partyId: rule.partyId }, rule.id);
        return true;
      });
      if (done) launched += 1;
    } catch (error) {
      if (!(error instanceof DomainError)) throw error;
      failed += 1;
    }
  }
  return { launched, failed };
}
