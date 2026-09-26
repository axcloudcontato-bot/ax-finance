import { z } from "zod";
import { withCompanyContext } from "@ax-finance/db";
import { assertActiveMembership } from "../companies/assert-membership";
import { recordAuditEvent } from "../audit/record-audit-event";
import { assertPeriodOpen } from "../closures/assert-period-open";
import {
  FinancialAccountNotFoundError,
  SettlementExceedsBalanceError,
  TitleNotFoundError,
  TitleNotOpenError,
} from "../errors";

export const registerSettlementInput = z.object({
  financialAccountId: z.string().uuid(),
  principalAmountCents: z.number().int().positive(),
  discountCents: z.number().int().min(0).default(0),
  interestPenaltyCents: z.number().int().min(0).default(0),
  feesCents: z.number().int().min(0).default(0),
  effectiveDate: z.coerce.date(),
  paymentMethod: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export type RegisterSettlementInput = z.infer<typeof registerSettlementInput>;

function computeStatus(
  originalCents: bigint,
  settledPrincipalEquivalentCents: bigint
): "OPEN" | "PARTIALLY_SETTLED" | "SETTLED" {
  if (settledPrincipalEquivalentCents <= BigInt(0)) return "OPEN";
  if (settledPrincipalEquivalentCents >= originalCents) return "SETTLED";
  return "PARTIALLY_SETTLED";
}

/**
 * O ponto crítico da Seção 30: "duas baixas concorrentes acima do saldo:
 * uma é rejeitada". `SELECT ... FOR UPDATE` trava a linha do título dentro
 * da transação — a segunda baixa concorrente só enxerga o saldo já
 * atualizado pela primeira depois que ela commitar. Prisma não expõe lock
 * de linha via API tipada, por isso o SELECT é raw.
 *
 * Saldo aberto = original − principal liquidado − desconto (Seção 13: o
 * desconto extingue principal). Juros/multa recebidos e taxas retidas NÃO
 * reduzem o principal — são componentes à parte (Seção 6/18 regra 12):
 * exemplo do doc, título de R$1.000 com R$400 pagos e R$8 de taxa retida
 * continua com R$600 em aberto, não R$592.
 */
export async function registerSettlement(
  userId: string,
  companyId: string,
  titleId: string,
  input: unknown
) {
  const data = registerSettlementInput.parse(input);
  await assertActiveMembership(userId, companyId);

  return withCompanyContext(userId, companyId, async (tx) => {
    const locked = await tx.$queryRaw<
      { id: string; original_amount_cents: bigint; status: string; type: string }[]
    >`SELECT id, original_amount_cents, status, type FROM "titles" WHERE id = ${titleId} AND company_id = ${companyId} FOR UPDATE`;

    const title = locked[0];
    if (!title) {
      throw new TitleNotFoundError();
    }
    if (title.status === "CANCELLED") {
      throw new TitleNotOpenError();
    }

    const account = await tx.financialAccount.findFirst({
      where: { id: data.financialAccountId, companyId },
    });
    if (!account) {
      throw new FinancialAccountNotFoundError();
    }

    await assertPeriodOpen(tx, companyId, data.effectiveDate);

    const existingSettlements = await tx.settlement.findMany({
      where: { titleId, reversedAt: null },
    });
    const alreadySettled = existingSettlements.reduce(
      (sum, settlement) => sum + settlement.principalAmountCents + settlement.discountCents,
      BigInt(0)
    );
    const remaining = title.original_amount_cents - alreadySettled;
    const principalEquivalent = BigInt(data.principalAmountCents) + BigInt(data.discountCents);

    if (principalEquivalent > remaining) {
      throw new SettlementExceedsBalanceError();
    }

    const settlement = await tx.settlement.create({
      data: {
        companyId,
        titleId,
        financialAccountId: data.financialAccountId,
        principalAmountCents: BigInt(data.principalAmountCents),
        discountCents: BigInt(data.discountCents),
        interestPenaltyCents: BigInt(data.interestPenaltyCents),
        feesCents: BigInt(data.feesCents),
        effectiveDate: data.effectiveDate,
        paymentMethod: data.paymentMethod,
        notes: data.notes,
      },
    });

    await tx.title.update({
      where: { id: titleId },
      data: { status: computeStatus(title.original_amount_cents, alreadySettled + principalEquivalent) },
    });

    await recordAuditEvent(tx, {
      companyId,
      actorUserId: userId,
      eventType: "SETTLEMENT_REGISTERED",
      resourceType: "Title",
      resourceId: titleId,
      summary: "Baixa registrada",
      metadata: {
        settlementId: settlement.id,
        titleType: title.type,
        principalAmountCents: data.principalAmountCents,
        financialAccountId: data.financialAccountId,
      },
    });

    return settlement;
  });
}
