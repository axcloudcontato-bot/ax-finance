import { z } from "zod";
import { withCompanyContext } from "@ax-finance/db";
import { assertCompanyPermission } from "../companies/permissions";
import { PartyDocumentAlreadyExistsError, PartyNotFoundError, PartyRoleRequiredError } from "../errors";

export const updatePartyInput = z.object({
  name: z.string().trim().min(1).max(200), tradeName: z.string().trim().max(200).optional(),
  document: z.string().trim().max(30).optional(), email: z.string().trim().max(200).optional(),
  phone: z.string().trim().max(30).optional(), address: z.string().trim().max(500).optional(),
  responsibleName: z.string().trim().max(200).optional(), notes: z.string().trim().max(2000).optional(),
  isClient: z.boolean(), isSupplier: z.boolean(),
});

export async function updateParty(userId: string, companyId: string, partyId: string, input: unknown) {
  const data = updatePartyInput.parse(input);
  if (!data.isClient && !data.isSupplier) throw new PartyRoleRequiredError();
  await assertCompanyPermission(userId, companyId, "CATALOG_WRITE");
  const normalized = data.document ? data.document.replace(/\D/g, "") || undefined : undefined;
  return withCompanyContext(userId, companyId, async (tx) => {
    if (!(await tx.party.findFirst({ where: { id: partyId, companyId } }))) throw new PartyNotFoundError();
    if (normalized && await tx.party.findFirst({ where: { companyId, documentNormalized: normalized, id: { not: partyId } } })) throw new PartyDocumentAlreadyExistsError();
    return tx.party.update({ where: { id: partyId }, data: {
      ...data, tradeName: data.tradeName || null, document: data.document || null, documentNormalized: normalized || null,
      email: data.email || null, phone: data.phone || null, address: data.address || null,
      responsibleName: data.responsibleName || null, notes: data.notes || null,
    } });
  });
}

export async function reactivateParty(userId: string, companyId: string, partyId: string) {
  await assertCompanyPermission(userId, companyId, "CATALOG_WRITE");
  return withCompanyContext(userId, companyId, async (tx) => {
    if (!(await tx.party.findFirst({ where: { id: partyId, companyId } }))) throw new PartyNotFoundError();
    return tx.party.update({ where: { id: partyId }, data: { status: "ACTIVE" } });
  });
}
