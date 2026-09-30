import { randomUUID } from "node:crypto";
import { z } from "zod";
import { withUserContext } from "@ax-finance/db";
import { scheduleCompanyJobsInTx } from "../scheduled-jobs/jobs";
import { createTrialSubscriptionInTx } from "../subscriptions/subscriptions";

export const createCompanyInput = z.object({
  name: z.string().trim().min(1).max(200),
  planCode: z.enum(["PERSONAL", "ESSENTIAL"]).default("ESSENTIAL"),
  currency: z.string().length(3).default("BRL"),
  timezone: z.string().min(1).default("America/Sao_Paulo"),
});

export type CreateCompanyInput = z.infer<typeof createCompanyInput>;

/**
 * Cria tenant + empresa + membership de proprietário numa única transação.
 * É a única escrita que legitimamente não tem uma empresa/membership prévios
 * para validar contra — por isso a política de RLS de INSERT em `companies`
 * só exige um usuário autenticado (ver migration de RLS).
 *
 * Cuidado: a política de SELECT de `companies` exige uma membership ATIVA,
 * e o Postgres aplica essa política também no RETURNING de um INSERT
 * (INSERT ... RETURNING é tratado como SELECT da linha inserida). Se
 * usássemos `tx.company.create(...)` normalmente, o Prisma sempre gera
 * RETURNING e a linha ainda não tem membership nesse instante — a operação
 * seria rejeitada como violação de RLS. Por isso o INSERT da empresa é feito
 * sem RETURNING (raw SQL, id gerado aqui), a membership é criada logo em
 * seguida, e só então lemos a empresa de volta.
 */
export async function createCompany(userId: string, input: unknown) {
  const data = createCompanyInput.parse(input);

  return withUserContext(userId, async (tx) => {
    const tenant = await tx.tenant.create({
      data: { name: data.name },
    });

    const companyId = randomUUID();
    await tx.$executeRaw`
      INSERT INTO "companies" ("id", "tenant_id", "name", "currency", "timezone", "status", "created_at", "updated_at")
      VALUES (${companyId}, ${tenant.id}, ${data.name}, ${data.currency}, ${data.timezone}, 'ACTIVE', now(), now())
    `;

    await tx.membership.create({
      data: {
        userId,
        companyId,
        role: "OWNER",
      },
    });

    await tx.$executeRaw`SELECT set_config('app.current_company_id', ${companyId}, true)`;
    await createTrialSubscriptionInTx(tx, companyId, data.planCode);

    await scheduleCompanyJobsInTx(tx, companyId, userId);

    return tx.company.findUniqueOrThrow({ where: { id: companyId } });
  });
}
