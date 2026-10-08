import { z } from "zod";
import { withCompanyContext } from "@ax-finance/db";
import { recordAuditEvent } from "../audit/record-audit-event";
import { assertCompanyPermission } from "../companies/permissions";
import { TitleCollectionInvalidError, TitleNotFoundError, TitleScheduleInvalidError } from "../errors";

const OPEN = ["OPEN", "PARTIALLY_SETTLED"];

/**
 * Marca a saída como "agendada no banco" para uma data (ou remove, com `null`). Não é baixa: o dinheiro
 * só sai da conta quando a baixa é registrada. Serve para não pagar duas vezes e saber o que já está resolvido.
 */
export async function setTitleScheduledPayment(userId: string, companyId: string, titleId: string, date: string | null) {
  const scheduled = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().parse(date);
  await assertCompanyPermission(userId, companyId, "FINANCE_WRITE");

  return withCompanyContext(userId, companyId, async (tx) => {
    const title = await tx.title.findFirst({ where: { id: titleId, companyId, deletedAt: null } });
    if (!title) throw new TitleNotFoundError();
    if (title.type !== "PAYABLE" || !OPEN.includes(title.status)) throw new TitleScheduleInvalidError();

    const updated = await tx.title.update({ where: { id: title.id }, data: { scheduledPaymentDate: scheduled ? new Date(`${scheduled}T00:00:00Z`) : null } });
    await recordAuditEvent(tx, {
      companyId, actorUserId: userId, resourceType: "Title", resourceId: title.id, summary: title.description,
      eventType: scheduled ? "TITLE_PAYMENT_SCHEDULED" : "TITLE_PAYMENT_SCHEDULE_REMOVED",
      metadata: { scheduledPaymentDate: scheduled },
    });
    return updated;
  });
}

/** Registra que a cobrança de um recebível em aberto foi feita agora (quantas vezes e quando). */
export async function registerTitleCollection(userId: string, companyId: string, titleId: string) {
  await assertCompanyPermission(userId, companyId, "FINANCE_WRITE");

  return withCompanyContext(userId, companyId, async (tx) => {
    const title = await tx.title.findFirst({ where: { id: titleId, companyId, deletedAt: null } });
    if (!title) throw new TitleNotFoundError();
    if (title.type !== "RECEIVABLE" || !OPEN.includes(title.status)) throw new TitleCollectionInvalidError();

    const updated = await tx.title.update({ where: { id: title.id }, data: { lastCollectionAt: new Date(), collectionCount: { increment: 1 } } });
    await recordAuditEvent(tx, {
      companyId, actorUserId: userId, eventType: "TITLE_COLLECTION_REGISTERED", resourceType: "Title", resourceId: title.id,
      summary: title.description, metadata: { collectionCount: updated.collectionCount },
    });
    return updated;
  });
}
