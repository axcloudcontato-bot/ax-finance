import { withCompanyContext } from "@ax-finance/db";
import { z } from "zod";
import { assertCompanyPermission } from "../companies/permissions";
import { assertFullReportAccess } from "../reports/report-snapshots";
import { reportDate } from "../reports/report-period";
import { recordAuditEvent } from "../audit/record-audit-event";
import { lockTitles } from "./lock-titles";
import { lockPeriodClosure } from "../closures/assert-period-open";
import { TitleNotFoundError } from "../errors";
import { assertExpectedAccount } from "./title-details";

const cashPlanInput = z.object({ expectedReceiptDate: reportDate.nullish(), promisedReceiptDate: reportDate.nullish(), receiptProbabilityBps: z.number().int().min(0).max(10000), cashPlanningNote: z.string().trim().max(500).nullish(), expectedAccountId: z.string().uuid().nullish() });
/** Informação de cobrança pode mudar após o fechamento; nunca altera vencimento ou saldo contratual. */
export async function setTitleCashPlan(userId: string, companyId: string, titleId: string, input: unknown) {
  const data = cashPlanInput.parse(input);
  await assertCompanyPermission(userId, companyId, "FINANCE_WRITE");
  return withCompanyContext(userId, companyId, async (tx) => {
    await lockPeriodClosure(tx, companyId, true);
    await lockTitles(tx, companyId, [titleId]);
    const title = await tx.title.findFirst({ where: { id: titleId, companyId, deletedAt: null, type: "RECEIVABLE", status: { in: ["OPEN", "PARTIALLY_SETTLED"] } } });
    if (!title) throw new TitleNotFoundError();
    await assertExpectedAccount(tx, companyId, data.expectedAccountId);
    const result = await tx.title.update({ where: { id: title.id }, data: { ...data, expectedReceiptDate: data.expectedReceiptDate ? new Date(data.expectedReceiptDate) : null, promisedReceiptDate: data.promisedReceiptDate ? new Date(data.promisedReceiptDate) : null, cashPlanningNote: data.cashPlanningNote || null } });
    await recordAuditEvent(tx, { companyId, actorUserId: userId, eventType: "TITLE_CASH_PLAN_UPDATED", resourceType: "Title", resourceId: titleId, summary: "Previsão de recebimento atualizada", metadata: { expectedReceiptDate: data.expectedReceiptDate ?? null, promisedReceiptDate: data.promisedReceiptDate ?? null, receiptProbabilityBps: data.receiptProbabilityBps, expectedAccountId: data.expectedAccountId ?? null } });
    return result;
  });
}

export async function setMinimumCashReserve(userId: string, companyId: string, input: unknown) {
  const data = z.object({ minimumCashReserveCents: z.number().int().safe().nonnegative() }).parse(input);
  await assertCompanyPermission(userId, companyId, "FINANCE_WRITE");
  await assertFullReportAccess(userId, companyId);
  return withCompanyContext(userId, companyId, async (tx) => {
    await lockPeriodClosure(tx, companyId, true);
    await tx.company.update({ where: { id: companyId }, data: { minimumCashReserveCents: BigInt(data.minimumCashReserveCents) } });
    await recordAuditEvent(tx, { companyId, actorUserId: userId, eventType: "CASH_RESERVE_UPDATED", resourceType: "Company", resourceId: companyId, summary: "Reserva mínima de caixa atualizada", metadata: { minimumCashReserveCents: data.minimumCashReserveCents } });
  });
}
