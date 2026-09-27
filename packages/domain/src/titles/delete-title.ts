import { z } from "zod";
import { withCompanyContext } from "@ax-finance/db";
import { assertCompanyPermission } from "../companies/permissions";
import { assertPeriodOpen } from "../closures/assert-period-open";
import { recordAuditEvent } from "../audit/record-audit-event";
import { TitleNotFoundError } from "../errors";

export const deleteTitleInput = z.object({
  reason: z.string().trim().min(1).max(500),
});

/**
 * Exclusão de verdade (não é `cancelTitle`, que só marca CANCELLED e nunca
 * apaga a linha) — a pedido explícito do usuário, mesmo que o título já
 * tenha baixas: apaga as baixas junto (e reabre pra "pendente" qualquer
 * linha de extrato que estivesse conciliada com elas, já que a linha do
 * banco em si continua real). Ainda respeita fechamento de período — apagar
 * um título/baixa de um mês fechado seria driblar exatamente a proteção que
 * o fechamento existe pra garantir. O motivo é obrigatório (mesmo padrão de
 * cancelar/estornar) — funciona como confirmação leve pra uma ação
 * irreversível, sem precisar de um dialog de JS no cliente.
 */
export async function deleteTitle(userId: string, companyId: string, titleId: string, input: unknown) {
  const data = deleteTitleInput.parse(input);
  await assertCompanyPermission(userId, companyId, "REVERSAL");

  return withCompanyContext(userId, companyId, async (tx) => {
    const title = await tx.title.findFirst({
      where: { id: titleId, companyId },
      include: { attachments: { select: { storageKey: true } } },
    });
    if (!title) {
      throw new TitleNotFoundError();
    }

    await assertPeriodOpen(tx, companyId, title.competenceDate);

    const settlements = await tx.settlement.findMany({ where: { titleId } });
    for (const settlement of settlements) {
      await assertPeriodOpen(tx, companyId, settlement.effectiveDate);
    }

    if (settlements.length > 0) {
      await tx.bankStatementLine.updateMany({
        where: { reconciledSettlementId: { in: settlements.map((s) => s.id) } },
        data: { reconciledSettlementId: null, status: "PENDING" },
      });
      await tx.settlement.deleteMany({ where: { titleId } });
    }

    await tx.title.delete({ where: { id: titleId } });

    await recordAuditEvent(tx, {
      companyId,
      actorUserId: userId,
      eventType: "TITLE_DELETED",
      resourceType: "Title",
      resourceId: titleId,
      summary: data.reason,
      metadata: {
        titleType: title.type,
        description: title.description,
        originalAmountCents: title.originalAmountCents.toString(),
        settlementsDeleted: settlements.length,
      },
    });
    return { attachmentStorageKeys: title.attachments.map((attachment) => attachment.storageKey) };
  });
}
