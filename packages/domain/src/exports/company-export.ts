import { withCompanyContext, withCompanyReadSnapshot } from "@ax-finance/db";
import { assertCompanyPermission } from "../companies/permissions";
import { recordAuditEvent } from "../audit/record-audit-event";

export async function buildCompanyFinalExport(userId: string, companyId: string, now = new Date()) {
  await assertCompanyPermission(userId, companyId, "MEMBERS_MANAGE");
  const archive = await withCompanyReadSnapshot(userId, companyId, async (tx) => {
    await assertCompanyPermission(userId, companyId, "MEMBERS_MANAGE");
    const company = await tx.company.findUniqueOrThrow({ where: { id: companyId }, select: { id: true, name: true, document: true, currency: true, timezone: true, status: true, createdAt: true, updatedAt: true, minimumCashReserveCents: true, lateFeeBps: true, lateInterestMonthlyBps: true, pixKey: true, pixReceiverName: true, pixCity: true } });
    const [memberships, accounts, budgets, creditCards, creditCardInvoices, creditCardPurchases, costCenters, categories, parties, recurrences, titles, settlements, refunds, allocations, transfers, adjustments, importBatches, bankLines, closures, attachments, audits, subscription, supportCases] = await Promise.all([
      tx.membership.findMany({ where: { companyId }, select: { id: true, userId: true, role: true, status: true, accessScope: true, accountAccess: { select: { financialAccountId: true } }, costCenterAccess: { select: { costCenterId: true } }, createdAt: true, updatedAt: true, user: { select: { name: true, email: true } } } }),
      tx.financialAccount.findMany({ where: { companyId } }),
      tx.budget.findMany({ where: { companyId } }),
      tx.creditCard.findMany({ where: { companyId } }),
      tx.creditCardInvoice.findMany({ where: { companyId } }),
      tx.creditCardPurchase.findMany({ where: { companyId } }),
      tx.costCenter.findMany({ where: { companyId } }),
      tx.category.findMany({ where: { companyId } }),
      tx.party.findMany({ where: { companyId } }),
      tx.recurrenceRule.findMany({ where: { companyId } }),
      tx.title.findMany({ where: { companyId } }),
      tx.settlement.findMany({ where: { companyId } }),
      tx.settlementRefund.findMany({ where: { companyId } }),
      tx.titleAllocation.findMany({ where: { companyId } }),
      tx.transfer.findMany({ where: { companyId } }),
      tx.balanceAdjustment.findMany({ where: { companyId } }),
      tx.importBatch.findMany({ where: { companyId }, select: { id: true, financialAccountId: true, fileName: true, fileFormat: true, status: true, fileSizeBytes: true, columnMapping: true, rowCount: true, importedCount: true, duplicateCount: true, invalidCount: true, startedAt: true, completedAt: true, failureCode: true, createdAt: true, updatedAt: true } }),
      tx.bankStatementLine.findMany({ where: { companyId } }),
      tx.periodClosure.findMany({ where: { companyId } }),
      tx.attachment.findMany({ where: { companyId }, select: { id: true, titleId: true, originalName: true, mimeType: true, sizeBytes: true, sha256: true, storageKey: true, storageBackend: true, scanStatus: true, scannedAt: true, createdAt: true } }),
      tx.auditEvent.findMany({ where: { companyId }, orderBy: { createdAt: "asc" } }),
      tx.subscription.findUnique({ where: { companyId } }),
      tx.supportCase.findMany({ where: { companyId }, select: { id: true, subject: true, summary: true, contactEmail: true, priority: true, status: true, resolution: true, resolvedAt: true, createdAt: true, updatedAt: true } }),
    ]);

    const [savingsGoals, debts, assets, reportSnapshots, categoryRules] = await Promise.all([
      tx.savingsGoal.findMany({ where: { companyId } }),
      tx.debt.findMany({ where: { companyId } }),
      tx.asset.findMany({ where: { companyId } }),
      tx.reportSnapshot.findMany({ where: { companyId }, orderBy: { createdAt: "asc" } }),
      tx.categoryRule.findMany({ where: { companyId } }),
    ]);

    return {
      format: "ax-finance-company-export",
      version: 2,
      exportedAt: now.toISOString(),
      notice: "Valores monetários são armazenados em centavos. Anexos físicos não estão incluídos; somente seus metadados.",
      company,
      savingsGoals,
      debts,
      assets,
      reportSnapshots,
      categoryRules,
      memberships,
      financialAccounts: accounts,
      budgets,
      creditCards,
      creditCardInvoices,
      creditCardPurchases,
      costCenters,
      categories,
      parties,
      recurrenceRules: recurrences,
      titles,
      settlements,
      settlementRefunds: refunds,
      titleAllocations: allocations,
      transfers,
      balanceAdjustments: adjustments,
      importBatches,
      bankStatementLines: bankLines,
      periodClosures: closures,
      attachmentMetadata: attachments,
      auditEvents: audits,
      subscription,
      supportCases,
    };
  });
  await withCompanyContext(userId, companyId, (tx) => recordAuditEvent(tx, { companyId, actorUserId: userId, eventType: "COMPANY_FINAL_EXPORT_GENERATED", resourceType: "Company", resourceId: companyId, summary: "Dados da exportação da empresa gerados", metadata: { version: 2, attachmentCount: archive.attachmentMetadata.length } }));
  return archive;
}
