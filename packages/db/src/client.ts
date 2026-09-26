import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __axFinancePrisma: PrismaClient | undefined;
}

// A aplicação nunca deve rodar com o mesmo usuário que possui as tabelas
// (usado só para migrations) — dono/superusuário do Postgres ignora Row
// Level Security. APP_DATABASE_URL aponta para o role `ax_app`, de baixo
// privilégio, que é o que de fato respeita as políticas de isolamento
// (ver prisma/migrations/*_rls_and_app_role).
const appDatabaseUrl = process.env.APP_DATABASE_URL;
if (!appDatabaseUrl) {
  throw new Error(
    "APP_DATABASE_URL não configurada. Defina-a no .env apontando para o role de aplicação (ax_app), não para o superusuário usado em migrations."
  );
}

export const prisma =
  globalThis.__axFinancePrisma ??
  new PrismaClient({ datasourceUrl: appDatabaseUrl });

if (process.env.NODE_ENV !== "production") {
  globalThis.__axFinancePrisma = prisma;
}

export * from "@prisma/client";

/**
 * Só para scripts de infraestrutura (seed, testes) que precisam de um client
 * apontando para uma URL específica — por exemplo, um client de superusuário
 * para housekeeping de teste, já que `ax_app` não tem política de DELETE em
 * `companies`/`memberships` (de propósito). Código de aplicação usa `prisma`.
 */
export function createPrismaClient(datasourceUrl: string): PrismaClient {
  return new PrismaClient({ datasourceUrl });
}
