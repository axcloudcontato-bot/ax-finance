import { withCompanyContext } from "@ax-finance/db";
import { assertActiveMembership } from "../companies/assert-membership";
import { PartyNotFoundError } from "../errors";

/**
 * Inativação preserva títulos (Seção 10) — nunca é um DELETE. Uma pessoa
 * inativa continua aparecendo nos títulos já lançados; só some dos selects
 * de novo lançamento (listParties com status ACTIVE).
 */
export async function deactivateParty(userId: string, companyId: string, partyId: string) {
  await assertActiveMembership(userId, companyId);

  return withCompanyContext(userId, companyId, async (tx) => {
    const party = await tx.party.findFirst({ where: { id: partyId, companyId } });
    if (!party) {
      throw new PartyNotFoundError();
    }

    return tx.party.update({
      where: { id: partyId },
      data: { status: "INACTIVE" },
    });
  });
}
