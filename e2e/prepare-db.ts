/** Cria o banco de E2E se faltar e, depois das migrations, zera as tabelas (roda via tsx, chamado pelo global-setup). */
import { createPrismaClient } from "@ax-finance/db";
import { E2E_DATABASE, E2E_DATABASE_URL } from "./env";

async function main(step: string) {
  if (step === "create") {
    const admin = new URL(E2E_DATABASE_URL);
    admin.pathname = "/postgres";
    const server = createPrismaClient(admin.toString());
    const exists = await server.$queryRawUnsafe<unknown[]>(`SELECT 1 FROM pg_database WHERE datname = '${E2E_DATABASE}'`);
    if (exists.length === 0) await server.$executeRawUnsafe(`CREATE DATABASE "${E2E_DATABASE}"`);
    await server.$disconnect();
    return;
  }
  const root = createPrismaClient(E2E_DATABASE_URL);
  const tables = await root.$queryRawUnsafe<{ tablename: string }[]>(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'",
  );
  await root.$executeRawUnsafe(`TRUNCATE TABLE ${tables.map((table) => `"${table.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);
  await root.$disconnect();
}

main(process.argv[2] ?? "reset").catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
