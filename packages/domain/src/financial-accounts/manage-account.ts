import { z } from "zod";
import { withCompanyContext } from "@ax-finance/db";
import { recordAuditEvent } from "../audit/record-audit-event";
import { assertCompanyPermission } from "../companies/permissions";
import { FinancialAccountHasBalanceError, FinancialAccountNotFoundError } from "../errors";
import { computeAccountBalanceDeltas } from "./account-balances";

const updateFinancialAccountInput = z.object({
  name: z.string().trim().min(1).max(200),
  type: z.enum(["BANK", "CASH", "WALLET"]),
  includedInAvailableTotal: z.boolean(),
});

export async function updateFinancialAccount(userId: string, companyId: string, accountId: string, input: unknown) {
  const data = updateFinancialAccountInput.parse(input);
  await assertCompanyPermission(userId, companyId, "FINANCE_WRITE");
  return withCompanyContext(userId, companyId, async (tx) => {
    const account = await tx.financialAccount.findFirst({ where: { id: accountId, companyId } });
    if (!account) throw new FinancialAccountNotFoundError();
    const updated = await tx.financialAccount.update({ where: { id: account.id }, data });
    await recordAuditEvent(tx, { companyId, actorUserId: userId, eventType: "FINANCIAL_ACCOUNT_UPDATED", resourceType: "FinancialAccount", resourceId: account.id, summary: account.name });
    return updated;
  });
}

export async function archiveFinancialAccount(userId: string, companyId: string, accountId: string) {
  await assertCompanyPermission(userId, companyId, "FINANCE_WRITE");
  return withCompanyContext(userId, companyId, async (tx) => {
    const account = await tx.financialAccount.findFirst({ where: { id: accountId, companyId } });
    if (!account) throw new FinancialAccountNotFoundError();
    const deltas = await computeAccountBalanceDeltas(tx, companyId);
    if (account.openingBalanceCents + (deltas.get(account.id) ?? BigInt(0)) !== BigInt(0)) throw new FinancialAccountHasBalanceError();
    const updated = await tx.financialAccount.update({ where: { id: account.id }, data: { status: "ARCHIVED", includedInAvailableTotal: false } });
    await recordAuditEvent(tx, { companyId, actorUserId: userId, eventType: "FINANCIAL_ACCOUNT_ARCHIVED", resourceType: "FinancialAccount", resourceId: account.id, summary: account.name });
    return updated;
  });
}

export async function reactivateFinancialAccount(userId: string, companyId: string, accountId: string) {
  await assertCompanyPermission(userId, companyId, "FINANCE_WRITE");
  return withCompanyContext(userId, companyId, async (tx) => {
    const account = await tx.financialAccount.findFirst({ where: { id: accountId, companyId } });
    if (!account) throw new FinancialAccountNotFoundError();
    const updated = await tx.financialAccount.update({ where: { id: account.id }, data: { status: "ACTIVE" } });
    await recordAuditEvent(tx, { companyId, actorUserId: userId, eventType: "FINANCIAL_ACCOUNT_REACTIVATED", resourceType: "FinancialAccount", resourceId: account.id, summary: account.name });
    return updated;
  });
}
