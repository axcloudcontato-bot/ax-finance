import type { TenantScopedClient } from "@ax-finance/db";

export interface RecordAuditEventParams {
  companyId: string;
  actorUserId: string;
  eventType: string;
  resourceType: string;
  resourceId: string;
  summary: string;
  metadata?: Record<string, string | number | boolean | null>;
}

/**
 * Grava um evento de auditoria imutável (Seção 18 regra 1: "eventos
 * financeiros gravam entradas imutáveis"). Recebe o `tx` de fora — nunca
 * abre transação própria — porque a Seção 18 regra 4 exige que baixa,
 * estorno/cancelamento e o evento de auditoria fiquem na MESMA transação:
 * se a mutação falhar e a transação for revertida, o evento nunca chega a
 * existir; não há como registrar "tentou e falhou" nem "aconteceu, mas o
 * log não".
 */
export async function recordAuditEvent(tx: TenantScopedClient, params: RecordAuditEventParams) {
  await tx.auditEvent.create({
    data: {
      companyId: params.companyId,
      actorUserId: params.actorUserId,
      eventType: params.eventType,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      summary: params.summary,
      metadata: params.metadata,
    },
  });
}
