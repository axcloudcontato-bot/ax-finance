import { createPrismaClient } from "@ax-finance/db";

/**
 * Cliente de teste conectado como o superusuário de migrations (não `ax_app`),
 * usado só para truncar tabelas entre testes. RLS não define política de
 * DELETE em `companies`/`memberships`, então o role de aplicação nem
 * conseguiria limpar essas tabelas — o que é o comportamento correto em
 * runtime, mas exige um client à parte para housekeeping de teste.
 */
export const rootClient = createPrismaClient(process.env.DATABASE_URL!);

export async function resetDatabase() {
  await rootClient.$executeRawUnsafe(
    'TRUNCATE TABLE "period_closures", "audit_events", "bank_statement_lines", "import_batches", "transfers", "settlements", "titles", "recurrence_rules", "parties", "categories", "financial_accounts", "memberships", "companies", "tenants", "sessions", "users" RESTART IDENTITY CASCADE'
  );
}
