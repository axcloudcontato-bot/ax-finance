import { randomUUID } from "node:crypto";
import { z } from "zod";
import { withUserContext } from "@ax-finance/db";
import { createDefaultCategoriesInTx } from "../categories/seed-default-categories";
import { scheduleCompanyJobsInTx } from "../scheduled-jobs/jobs";
import { createTrialSubscriptionInTx } from "../subscriptions/subscriptions";

export const completeOnboardingInput = z.object({
  companyName: z.string().trim().min(1).max(200),
  planCode: z.enum(["PERSONAL", "ESSENTIAL"]).default("ESSENTIAL"),
  accountName: z.string().trim().min(1).max(200),
  accountType: z.enum(["BANK", "CASH", "WALLET"]),
  openingBalanceCents: z.number().int(),
  openingDate: z.coerce.date(),
});

/**
 * Onboarding inteiro (empresa + membership + conta + categorias padrão) numa
 * única transação. Antes disso, `apps/web/app/onboarding/actions.ts` chamava
 * createCompany/createFinancialAccount/seedDefaultCategories em sequência,
 * cada um abrindo sua própria transação — se um passo do meio falhasse (ex.:
 * violação de constraint na conta), a empresa já criada ficava sem conta nem
 * categorias, e não há como voltar pro onboarding depois que já existe uma
 * empresa (o dashboard só redireciona pra lá quando a lista está vazia).
 * Tudo aqui roda como `createCompany` faria sozinho, mas continuando na
 * mesma transação para os passos seguintes.
 */
export async function completeOnboarding(userId: string, input: unknown) {
  const data = completeOnboardingInput.parse(input);

  return withUserContext(userId, async (tx) => {
    const tenant = await tx.tenant.create({
      data: { name: data.companyName },
    });

    const companyId = randomUUID();
    await tx.$executeRaw`
      INSERT INTO "companies" ("id", "tenant_id", "name", "currency", "timezone", "status", "created_at", "updated_at")
      VALUES (${companyId}, ${tenant.id}, ${data.companyName}, 'BRL', 'America/Sao_Paulo', 'ACTIVE', now(), now())
    `;

    await tx.membership.create({
      data: { userId, companyId, role: "OWNER" },
    });

    await scheduleCompanyJobsInTx(tx, companyId, userId);

    // A partir daqui as tabelas de dados (financial_accounts/categories) têm
    // política de RLS reforçada, que também confere
    // company_id = current_setting('app.current_company_id') — withUserContext
    // só definiu app.current_user_id. Como ainda estamos na mesma transação/
    // conexão, dá pra completar o contexto sem abrir uma nova.
    await tx.$executeRaw`SELECT set_config('app.current_company_id', ${companyId}, true)`;

    await createTrialSubscriptionInTx(tx, companyId, data.planCode);

    const account = await tx.financialAccount.create({
      data: {
        companyId,
        name: data.accountName,
        type: data.accountType,
        currency: "BRL",
        openingBalanceCents: BigInt(data.openingBalanceCents),
        openingDate: data.openingDate,
        includedInAvailableTotal: true,
      },
    });

    await createDefaultCategoriesInTx(tx, companyId);

    const company = await tx.company.findUniqueOrThrow({ where: { id: companyId } });

    return { company, account };
  });
}
