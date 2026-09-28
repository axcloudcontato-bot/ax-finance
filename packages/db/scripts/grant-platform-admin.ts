import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { PrismaClient, type PlatformAdminRole } from "@prisma/client";

const envPath = fileURLToPath(new URL("../../../.env", import.meta.url));
if (existsSync(envPath)) process.loadEnvFile(envPath);

const email = process.argv[2]?.trim().toLowerCase();
const requestedRole = process.argv[3]?.trim().toUpperCase() ?? "SUPER_ADMIN";
const roles = new Set<PlatformAdminRole>(["SUPER_ADMIN", "OPERATIONS", "SUPPORT", "ANALYST"]);
if (!email || !roles.has(requestedRole as PlatformAdminRole)) {
  throw new Error("Uso: pnpm admin:grant -- email@empresa.com SUPER_ADMIN|OPERATIONS|SUPPORT|ANALYST");
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não configurada para a operação administrativa.");

const client = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });
try {
  const user = await client.user.findUnique({ where: { email } });
  if (!user) throw new Error("Usuário não encontrado. Ele precisa criar a conta antes de receber acesso interno.");
  const admin = await client.platformAdmin.upsert({
    where: { userId: user.id },
    create: { userId: user.id, role: requestedRole as PlatformAdminRole, active: true },
    update: { role: requestedRole as PlatformAdminRole, active: true },
  });
  console.info(`Acesso interno concedido a ${email} com papel ${admin.role}.`);
} finally {
  await client.$disconnect();
}
