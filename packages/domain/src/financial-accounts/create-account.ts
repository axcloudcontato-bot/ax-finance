import { z } from "zod";
import { withCompanyContext } from "@ax-finance/db";
import { assertActiveMembership } from "../companies/assert-membership";

export const createFinancialAccountInput = z.object({
  name: z.string().trim().min(1).max(200),
  type: z.enum(["BANK", "CASH", "WALLET"]),
  currency: z.string().length(3).default("BRL"),
  // Centavos inteiros — nunca float — conforme regra transversal 1 (Seção 18).
  openingBalanceCents: z.number().int(),
  openingDate: z.coerce.date(),
  includedInAvailableTotal: z.boolean().default(true),
});

export type CreateFinancialAccountInput = z.infer<typeof createFinancialAccountInput>;

/**
 * Saldo inicial é posição patrimonial, não receita (Seção 8): esta função
 * apenas grava `financial_accounts`, sem tocar em nenhuma tabela de
 * movimento/receita — que ainda nem existe nesta etapa da fundação.
 */
export async function createFinancialAccount(
  userId: string,
  companyId: string,
  input: unknown
) {
  const data = createFinancialAccountInput.parse(input);
  await assertActiveMembership(userId, companyId);

  return withCompanyContext(userId, companyId, (tx) =>
    tx.financialAccount.create({
      data: {
        companyId,
        name: data.name,
        type: data.type,
        currency: data.currency,
        openingBalanceCents: BigInt(data.openingBalanceCents),
        openingDate: data.openingDate,
        includedInAvailableTotal: data.includedInAvailableTotal,
      },
    })
  );
}
