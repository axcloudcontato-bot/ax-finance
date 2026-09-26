import { z } from "zod";
import { withCompanyContext } from "@ax-finance/db";
import { assertActiveMembership } from "../companies/assert-membership";
import { TitleHasActiveSettlementsError, TitleNotFoundError } from "../errors";

export const cancelTitleInput = z.object({
  reason: z.string().trim().min(1).max(500),
});

/** Seção 6: cancelamento só é permitido quando não há baixa ativa. */
export async function cancelTitle(
  userId: string,
  companyId: string,
  titleId: string,
  input: unknown
) {
  const data = cancelTitleInput.parse(input);
  await assertActiveMembership(userId, companyId);

  return withCompanyContext(userId, companyId, async (tx) => {
    const title = await tx.title.findFirst({ where: { id: titleId, companyId } });
    if (!title) {
      throw new TitleNotFoundError();
    }

    const activeSettlement = await tx.settlement.findFirst({
      where: { titleId, reversedAt: null },
    });
    if (activeSettlement) {
      throw new TitleHasActiveSettlementsError();
    }

    return tx.title.update({
      where: { id: titleId },
      data: { status: "CANCELLED", cancelReason: data.reason },
    });
  });
}
