import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "./client";

export type TenantScopedClient = Prisma.TransactionClient;

/**
 * Every write/read that touches company-scoped tables must go through here.
 * It sets the Postgres session variables the RLS policies check
 * (see prisma/migrations/*_rls/migration.sql), inside the same transaction
 * used for the actual query, so the database enforces isolation even if an
 * application-layer check is ever missed.
 */
export async function withUserContext<T>(
  userId: string,
  fn: (tx: TenantScopedClient) => Promise<T>,
  client: PrismaClient = prisma
): Promise<T> {
  return client.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true)`;
    return fn(tx);
  });
}

/**
 * Use when the operation is scoped to one active company. Callers must have
 * already verified an ACTIVE membership for (userId, companyId) before
 * calling this — the RLS policy trusts app.current_company_id once set.
 */
export async function withCompanyContext<T>(
  userId: string,
  companyId: string,
  fn: (tx: TenantScopedClient) => Promise<T>,
  client: PrismaClient = prisma
): Promise<T> {
  return client.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true)`;
    await tx.$executeRaw`SELECT set_config('app.current_company_id', ${companyId}, true)`;
    return fn(tx);
  });
}
