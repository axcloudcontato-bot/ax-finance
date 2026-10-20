import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "./client";
import { AsyncLocalStorage } from "node:async_hooks";

export type TenantScopedClient = Prisma.TransactionClient;

// Somente leituras compostas aderem a este escopo. Impede misturar empresas
// e mantém os serviços existentes na mesma fotografia transacional.
const readSnapshot = new AsyncLocalStorage<{ userId: string; companyId: string; tx: TenantScopedClient }>();

export async function withCompanyReadSnapshot<T>(
  userId: string,
  companyId: string,
  fn: (tx: TenantScopedClient) => Promise<T>,
): Promise<T> {
  const existing = readSnapshot.getStore();
  if (existing) {
    if (existing.userId !== userId || existing.companyId !== companyId) throw new Error("Contexto de leitura incompatível.");
    return fn(existing.tx);
  }
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    await tx.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true)`;
    await tx.$executeRaw`SELECT set_config('app.current_company_id', ${companyId}, true)`;
    return readSnapshot.run({ userId, companyId, tx }, () => fn(tx));
  }, { isolationLevel: "RepeatableRead", timeout: 60_000, maxWait: 10_000 });
}

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
  const snapshot = readSnapshot.getStore();
  if (snapshot && client === prisma) {
    if (snapshot.userId !== userId) throw new Error("Contexto de leitura incompatível.");
    return fn(snapshot.tx);
  }
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
  client: PrismaClient = prisma,
  options: { timeout?: number; maxWait?: number } = {},
): Promise<T> {
  const snapshot = readSnapshot.getStore();
  if (snapshot && client === prisma) {
    if (snapshot.userId !== userId || snapshot.companyId !== companyId) throw new Error("Contexto de leitura incompatível.");
    return fn(snapshot.tx);
  }
  return client.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true)`;
    await tx.$executeRaw`SELECT set_config('app.current_company_id', ${companyId}, true)`;
    return fn(tx);
  }, options);
}
