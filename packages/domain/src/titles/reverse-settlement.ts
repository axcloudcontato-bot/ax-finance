import { z } from "zod";
import { withCompanyContext } from "@ax-finance/db";
import { assertActiveMembership } from "../companies/assert-membership";
import { SettlementAlreadyReversedError, TitleNotFoundError } from "../errors";

export const reverseSettlementInput = z.object({
  reason: z.string().trim().min(1).max(500),
});

function computeStatus(
  originalCents: bigint,
  settledPrincipalEquivalentCents: bigint
): "OPEN" | "PARTIALLY_SETTLED" | "SETTLED" {
  if (settledPrincipalEquivalentCents <= BigInt(0)) return "OPEN";
  if (settledPrincipalEquivalentCents >= originalCents) return "SETTLED";
  return "PARTIALLY_SETTLED";
}

/**
 * Estorno técnico nunca apaga a baixa original (Seção 18 regras 7 e 10) —
 * só marca reversedAt/reversalReason. O saldo do título é recalculado a
 * partir dos registros de origem (regra 11: caches não são fonte oficial).
 */
export async function reverseSettlement(
  userId: string,
  companyId: string,
  settlementId: string,
  input: unknown
) {
  const data = reverseSettlementInput.parse(input);
  await assertActiveMembership(userId, companyId);

  return withCompanyContext(userId, companyId, async (tx) => {
    const settlement = await tx.settlement.findFirst({
      where: { id: settlementId, companyId },
    });
    if (!settlement) {
      throw new TitleNotFoundError();
    }
    if (settlement.reversedAt) {
      throw new SettlementAlreadyReversedError();
    }

    const locked = await tx.$queryRaw<{ id: string; original_amount_cents: bigint }[]>`
      SELECT id, original_amount_cents FROM "titles" WHERE id = ${settlement.titleId} AND company_id = ${companyId} FOR UPDATE
    `;
    const title = locked[0];
    if (!title) {
      throw new TitleNotFoundError();
    }

    const reversed = await tx.settlement.update({
      where: { id: settlementId },
      data: { reversedAt: new Date(), reversalReason: data.reason },
    });

    const remainingActive = await tx.settlement.findMany({
      where: { titleId: settlement.titleId, reversedAt: null },
    });
    const settledPrincipalEquivalent = remainingActive.reduce(
      (sum, active) => sum + active.principalAmountCents + active.discountCents,
      BigInt(0)
    );

    await tx.title.update({
      where: { id: settlement.titleId },
      data: { status: computeStatus(title.original_amount_cents, settledPrincipalEquivalent) },
    });

    return reversed;
  });
}
