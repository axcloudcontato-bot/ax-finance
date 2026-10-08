import { z } from "zod";
import { withCompanyContext } from "@ax-finance/db";
import { recordAuditEvent } from "../audit/record-audit-event";
import { assertActiveMembership } from "./assert-membership";
import { assertCompanyPermission } from "./permissions";

/** Percentuais em pontos-base (200 = 2%), de 0 a 20%. */
export const lateFeeSettingsInput = z.object({
  lateFeeBps: z.number().int().min(0).max(2000),
  lateInterestMonthlyBps: z.number().int().min(0).max(2000),
});

export async function getLateFeeSettings(userId: string, companyId: string) {
  await assertActiveMembership(userId, companyId);
  const company = await withCompanyContext(userId, companyId, (tx) =>
    tx.company.findUniqueOrThrow({ where: { id: companyId }, select: { lateFeeBps: true, lateInterestMonthlyBps: true } })
  );
  return { lateFeeBps: company.lateFeeBps, lateInterestMonthlyBps: company.lateInterestMonthlyBps };
}

/** Multa e juros ao mês cobrados em atraso: só sugerem valores ao registrar a baixa de um recebível vencido. */
export async function updateLateFeeSettings(userId: string, companyId: string, input: unknown) {
  const data = lateFeeSettingsInput.parse(input);
  await assertCompanyPermission(userId, companyId, "FINANCE_WRITE");
  return withCompanyContext(userId, companyId, async (tx) => {
    const updated = await tx.company.update({
      where: { id: companyId },
      data,
      select: { lateFeeBps: true, lateInterestMonthlyBps: true },
    });
    await recordAuditEvent(tx, {
      companyId, actorUserId: userId, eventType: "LATE_FEE_SETTINGS_UPDATED", resourceType: "Company", resourceId: companyId,
      summary: `Multa ${data.lateFeeBps / 100}% · juros ${data.lateInterestMonthlyBps / 100}% ao mês`, metadata: data,
    });
    return updated;
  });
}
