import { z } from "zod";
import { withCompanyContext } from "@ax-finance/db";
import { assertCompanyPermission } from "../companies/permissions";
import { recordAuditEvent } from "../audit/record-audit-event";
import { FinancialAccountNotFoundError, TransferSameAccountError } from "../errors";

export const createTransferInput = z.object({
  fromAccountId: z.string().uuid(),
  toAccountId: z.string().uuid(),
  amountCents: z.number().int().positive(),
  feeCents: z.number().int().min(0).default(0),
  transferDate: z.coerce.date(),
  description: z.string().trim().max(500).optional(),
});

export type CreateTransferInput = z.infer<typeof createTransferInput>;

/**
 * As duas pontas são gravadas num único INSERT (uma linha), então já são
 * atômicas por construção — não existe estado intermediário onde só um lado
 * foi debitado (Seção 8). P0 não permite contas de empresas diferentes; como
 * ambas são resolvidas dentro do mesmo `withCompanyContext`, isso já é
 * garantido pelo filtro `companyId` nas duas buscas.
 */
export async function createTransfer(userId: string, companyId: string, input: unknown) {
  const data = createTransferInput.parse(input);

  if (data.fromAccountId === data.toAccountId) {
    throw new TransferSameAccountError();
  }

  await assertCompanyPermission(userId, companyId, "FINANCE_WRITE");

  return withCompanyContext(userId, companyId, async (tx) => {
    const [fromAccount, toAccount] = await Promise.all([
      tx.financialAccount.findFirst({ where: { id: data.fromAccountId, companyId, status: "ACTIVE" } }),
      tx.financialAccount.findFirst({ where: { id: data.toAccountId, companyId, status: "ACTIVE" } }),
    ]);
    if (!fromAccount || !toAccount) {
      throw new FinancialAccountNotFoundError();
    }

    const transfer = await tx.transfer.create({
      data: {
        companyId,
        fromAccountId: data.fromAccountId,
        toAccountId: data.toAccountId,
        amountCents: BigInt(data.amountCents),
        feeCents: BigInt(data.feeCents),
        transferDate: data.transferDate,
        description: data.description,
      },
    });

    await recordAuditEvent(tx, {
      companyId,
      actorUserId: userId,
      eventType: "TRANSFER_CREATED",
      resourceType: "Transfer",
      resourceId: transfer.id,
      summary: "Transferência criada",
      metadata: {
        amountCents: data.amountCents,
        fromAccountId: data.fromAccountId,
        toAccountId: data.toAccountId,
      },
    });

    return transfer;
  });
}
