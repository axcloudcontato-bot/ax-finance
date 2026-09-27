import { withCompanyContext } from "@ax-finance/db";
import { assertCompanyPermission } from "../companies/permissions";
import { PartyNotFoundError } from "../errors";

/**
 * Inativação preserva títulos (Seção 10) — nunca é um DELETE. Uma pessoa
 * inativa continua aparecendo nos títulos já lançados; só some dos selects
 * de novo lançamento (listParties com status ACTIVE).
 */
export async function deactivateParty(userId: string, companyId: string, partyId: string) {
  await assertCompanyPermission(userId, companyId, "CATALOG_WRITE");

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
