import { z } from "zod";
import { withCompanyContext } from "@ax-finance/db";
import { assertActiveMembership } from "../companies/assert-membership";
import { PartyDocumentAlreadyExistsError, PartyRoleRequiredError } from "../errors";

export const createPartyInput = z.object({
  name: z.string().trim().min(1).max(200),
  tradeName: z.string().trim().max(200).optional(),
  document: z.string().trim().max(30).optional(),
  email: z.string().trim().max(200).optional(),
  phone: z.string().trim().max(30).optional(),
  address: z.string().trim().max(500).optional(),
  responsibleName: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(2000).optional(),
  isClient: z.boolean().default(false),
  isSupplier: z.boolean().default(false),
});

export type CreatePartyInput = z.infer<typeof createPartyInput>;

function normalizeDocument(document: string | undefined): string | undefined {
  if (!document) return undefined;
  const digits = document.replace(/\D/g, "");
  return digits.length > 0 ? digits : undefined;
}

/**
 * Cadastro unificado de pessoa (Seção 10): papéis cliente/fornecedor podem
 * coexistir, mas ao menos um é exigido. Documento normalizado (só dígitos)
 * é único por empresa quando informado, mas homônimos sem documento são
 * permitidos — validação de formato aqui não prova regularidade cadastral.
 */
export async function createParty(userId: string, companyId: string, input: unknown) {
  const data = createPartyInput.parse(input);
  if (!data.isClient && !data.isSupplier) {
    throw new PartyRoleRequiredError();
  }
  await assertActiveMembership(userId, companyId);

  const documentNormalized = normalizeDocument(data.document);

  return withCompanyContext(userId, companyId, async (tx) => {
    if (documentNormalized) {
      const existing = await tx.party.findFirst({
        where: { companyId, documentNormalized },
      });
      if (existing) {
        throw new PartyDocumentAlreadyExistsError();
      }
    }

    return tx.party.create({
      data: {
        companyId,
        name: data.name,
        tradeName: data.tradeName,
        document: data.document,
        documentNormalized,
        email: data.email,
        phone: data.phone,
        address: data.address,
        responsibleName: data.responsibleName,
        notes: data.notes,
        isClient: data.isClient,
        isSupplier: data.isSupplier,
      },
    });
  });
}
