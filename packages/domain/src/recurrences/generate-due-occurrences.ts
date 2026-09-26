import { withCompanyContext } from "@ax-finance/db";
import { assertActiveMembership } from "../companies/assert-membership";
import { computeOccurrenceDates } from "./recurrence-dates";

const HORIZON_DAYS = 90;

function toDateOnlyString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDaysUTC(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const result = new Date(Date.UTC(year!, month! - 1, day! + days));
  return result.toISOString().slice(0, 10);
}

/**
 * Rotina idempotente da Seção 11: materializa, para cada regra ATIVA da
 * empresa, os títulos de todas as ocorrências entre o início da regra e o
 * horizonte (hoje + 90 dias) que ainda não existem — a checagem por
 * (recurrenceRuleId, recurrenceOccurrenceDate) garante que rodar de novo
 * nunca duplica um título já gerado. Chamada tanto de forma preguiçosa (ao
 * carregar entradas/saídas/dashboard) quanto pelo botão manual "Gerar
 * títulos pendentes".
 */
export async function generateDueOccurrences(userId: string, companyId: string) {
  await assertActiveMembership(userId, companyId);

  const today = toDateOnlyString(new Date());
  const horizon = addDaysUTC(today, HORIZON_DAYS);

  return withCompanyContext(userId, companyId, async (tx) => {
    const rules = await tx.recurrenceRule.findMany({ where: { companyId, status: "ACTIVE" } });

    let createdCount = 0;
    for (const rule of rules) {
      const startDate = toDateOnlyString(rule.startDate);
      const endDate = rule.endDate ? toDateOnlyString(rule.endDate) : null;
      const occurrenceDates = computeOccurrenceDates(startDate, rule.dayOfMonth, endDate, horizon);

      for (const occurrenceDate of occurrenceDates) {
        const occurrenceAsDate = new Date(occurrenceDate);
        const existing = await tx.title.findFirst({
          where: { recurrenceRuleId: rule.id, recurrenceOccurrenceDate: occurrenceAsDate },
        });
        if (existing) continue;

        await tx.title.create({
          data: {
            companyId,
            type: rule.type,
            description: rule.description,
            categoryId: rule.categoryId,
            partyId: rule.partyId,
            originalAmountCents: rule.amountCents,
            competenceDate: occurrenceAsDate,
            dueDate: occurrenceAsDate,
            notes: rule.notes,
            recurrenceRuleId: rule.id,
            recurrenceOccurrenceDate: occurrenceAsDate,
          },
        });
        createdCount++;
      }
    }

    return { createdCount };
  });
}
