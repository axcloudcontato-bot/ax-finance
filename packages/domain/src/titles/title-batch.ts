import { z } from "zod";
import { withCompanyContext, type TenantScopedClient } from "@ax-finance/db";
import { recordAuditEvent } from "../audit/record-audit-event";
import { assertPeriodOpen } from "../closures/assert-period-open";
import { assertCompanyPermission } from "../companies/permissions";
import { randomUUID } from "node:crypto";
import { CategoryNotFoundError, CostCenterNotFoundError, FinancialAccountNotFoundError, TitleBatchInvalidError } from "../errors";
import { beginIdempotentOperation, completeIdempotentOperation, idempotencyKeySchema } from "../idempotency/operations";
import { assertInvoiceTitlePayable, assertTitleNotCardInvoice } from "../credit-cards/invoices";
import { OPERATIONAL_ACCOUNT } from "../financial-accounts/operational";

export const titleBatchInput = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("SETTLE_FULL"), titleIds: z.array(z.string().uuid()).min(1).max(100), financialAccountId: z.string().uuid(), effectiveDate: z.coerce.date(), idempotencyKey: idempotencyKeySchema }),
  z.object({ operation: z.literal("CANCEL"), titleIds: z.array(z.string().uuid()).min(1).max(100), reason: z.string().trim().min(1).max(500), idempotencyKey: idempotencyKeySchema }),
  z.object({ operation: z.literal("CLASSIFY"), titleIds: z.array(z.string().uuid()).min(1).max(100), categoryId: z.string().uuid(), costCenterId: z.string().uuid().optional(), idempotencyKey: idempotencyKeySchema }),
]);

export type TitleBatchInput = z.infer<typeof titleBatchInput>;

async function loadBatch(tx: TenantScopedClient, companyId: string, titleIds: string[]) {
  const uniqueIds = [...new Set(titleIds)];
  const titles = await tx.title.findMany({
    where: { companyId, id: { in: uniqueIds }, deletedAt: null },
    include: { category: true, costCenter: true, settlements: { where: { reversedAt: null } } },
    orderBy: { dueDate: "asc" },
  });
  if (titles.length !== uniqueIds.length) throw new TitleBatchInvalidError("Um ou mais títulos não foram encontrados ou estão fora do seu escopo de acesso.");
  return titles.map((title) => ({
    ...title,
    remainingCents: title.originalAmountCents - title.settlements.reduce((sum, item) => sum + item.principalAmountCents + item.discountCents, BigInt(0)),
  }));
}

export async function previewTitleBatch(userId: string, companyId: string, input: unknown) {
  const data = titleBatchInput.parse(input);
  await assertCompanyPermission(userId, companyId, "FINANCE_WRITE");
  return withCompanyContext(userId, companyId, async (tx) => {
    const titles = await loadBatch(tx, companyId, data.titleIds);
    const cardInvoiceTitleIds = new Set((await tx.creditCardInvoice.findMany({ where: { companyId, titleId: { in: titles.map((title) => title.id) } }, select: { titleId: true } })).map((invoice) => invoice.titleId));
    const problems = titles.flatMap((title) => {
      if (data.operation === "SETTLE_FULL" && (title.status === "CANCELLED" || title.remainingCents <= BigInt(0))) return [`${title.description}: sem saldo aberto`];
      if (data.operation !== "SETTLE_FULL" && cardInvoiceTitleIds.has(title.id)) return [`${title.description}: é fatura de cartão e muda pelas compras`];
      if (data.operation === "CANCEL" && title.settlements.length > 0) return [`${title.description}: possui baixa ativa`];
      if (data.operation === "CANCEL" && title.status === "CANCELLED") return [`${title.description}: já está cancelado`];
      return [];
    });
    return { operation: data.operation, titles, problems, totalCents: titles.reduce((sum, title) => sum + (data.operation === "SETTLE_FULL" ? title.remainingCents : title.originalAmountCents), BigInt(0)) };
  });
}

/**
 * Mesma proteção de `registerSettlement` (Seção 30): trava as linhas antes de
 * calcular o saldo restante, senão dois lotes (ou um lote e uma baixa
 * individual) leem o mesmo saldo e liquidam o título duas vezes. A ordem por
 * id evita deadlock entre lotes que compartilham títulos.
 */
async function lockBatchTitles(tx: TenantScopedClient, companyId: string, titleIds: string[]) {
  const uniqueIds = [...new Set(titleIds)];
  // Array nativo em vez de Prisma.join: dentro do Next o helper vira uma segunda
  // cópia que o motor não reconhece como SQL e é enviado como JSON
  // ("operator does not exist: text = jsonb"). Os testes de domínio não pegam isso.
  await tx.$queryRaw`
    SELECT id FROM "titles"
    WHERE company_id = ${companyId} AND id = ANY(${uniqueIds}::text[]) AND deleted_at IS NULL
    ORDER BY id
    FOR UPDATE
  `;
}

export async function applyTitleBatch(userId: string, companyId: string, input: unknown) {
  const data = titleBatchInput.parse(input);
  await assertCompanyPermission(userId, companyId, "FINANCE_WRITE");
  return withCompanyContext(userId, companyId, async (tx) => {
    // A chave e as mudanças vivem na mesma transação: se qualquer título do lote
    // falhar, a chave também é desfeita e o usuário pode corrigir e reenviar.
    // O pedido é normalizado (ids únicos e ordenados) para que a mesma seleção
    // em outra ordem conte como o mesmo pedido.
    const { idempotencyKey, ...rest } = data;
    const uniqueIds = [...new Set(data.titleIds)].sort();
    const idempotency = await beginIdempotentOperation(tx, {
      companyId,
      operation: `TITLE_BATCH:${data.operation}`,
      key: idempotencyKey,
      request: { ...rest, titleIds: uniqueIds },
      resourceType: "TitleBatch",
    });
    if (idempotency.kind === "replay") {
      return { count: uniqueIds.length, operation: data.operation, replayed: true as const };
    }

    await lockBatchTitles(tx, companyId, data.titleIds);
    const titles = await loadBatch(tx, companyId, data.titleIds);
    if (data.operation !== "SETTLE_FULL") {
      for (const title of titles) await assertTitleNotCardInvoice(tx, companyId, title.id);
    }
    const invalid = titles.some((title) =>
      data.operation === "SETTLE_FULL" ? title.status === "CANCELLED" || title.remainingCents <= BigInt(0)
      : data.operation === "CANCEL" ? title.status === "CANCELLED" || title.settlements.length > 0
      : false
    );
    if (invalid) throw new TitleBatchInvalidError();

    if (data.operation === "SETTLE_FULL") {
      if (!(await tx.financialAccount.findFirst({ where: { id: data.financialAccountId, companyId, status: "ACTIVE", ...OPERATIONAL_ACCOUNT } }))) throw new FinancialAccountNotFoundError();
      await assertPeriodOpen(tx, companyId, data.effectiveDate);
      for (const title of titles) await assertInvoiceTitlePayable(tx, companyId, title.id);
      for (const title of titles) {
        await tx.settlement.create({ data: { companyId, titleId: title.id, financialAccountId: data.financialAccountId, principalAmountCents: title.remainingCents, effectiveDate: data.effectiveDate, notes: "Baixa integral em lote" } });
        await tx.title.update({ where: { id: title.id }, data: { status: "SETTLED" } });
        await recordAuditEvent(tx, { companyId, actorUserId: userId, eventType: "TITLE_BATCH_SETTLED", resourceType: "Title", resourceId: title.id, summary: "Baixa integral em lote" });
      }
    } else if (data.operation === "CANCEL") {
      for (const title of titles) {
        await tx.title.update({ where: { id: title.id }, data: { status: "CANCELLED", cancelReason: data.reason } });
        await recordAuditEvent(tx, { companyId, actorUserId: userId, eventType: "TITLE_BATCH_CANCELLED", resourceType: "Title", resourceId: title.id, summary: data.reason });
      }
    } else {
      if (!(await tx.category.findFirst({ where: { id: data.categoryId, companyId, status: "ACTIVE" } }))) throw new CategoryNotFoundError();
      if (data.costCenterId && !(await tx.costCenter.findFirst({ where: { id: data.costCenterId, companyId, status: "ACTIVE" } }))) throw new CostCenterNotFoundError();
      for (const title of titles) {
        await tx.title.update({ where: { id: title.id }, data: { categoryId: data.categoryId, costCenterId: data.costCenterId ?? null } });
        await recordAuditEvent(tx, { companyId, actorUserId: userId, eventType: "TITLE_BATCH_CLASSIFIED", resourceType: "Title", resourceId: title.id, summary: "Classificação alterada em lote" });
      }
    }
    await completeIdempotentOperation(tx, idempotency, randomUUID());
    return { count: titles.length, operation: data.operation, replayed: false as const };
  });
}
