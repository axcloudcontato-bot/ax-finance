/**
 * Imprime o link de confirmação do último e-mail EMAIL_VERIFICATION enviado para o endereço dado,
 * como o worker montaria. Roda num processo próprio, apontado para o banco de E2E.
 */
import { decodeOutboxEmailPayload } from "@ax-finance/domain";
import { prisma } from "@ax-finance/db";

async function main() {
  const email = process.argv[2]?.toLowerCase();
  if (!email) throw new Error("Uso: tsx e2e/verification-link.ts <email>");
  if (!process.env.DATABASE_URL?.includes("ax_finance_e2e")) throw new Error("Só roda no banco ax_finance_e2e.");
  const events = await prisma.outboxEvent.findMany({ where: { type: "EMAIL_VERIFICATION" }, orderBy: { createdAt: "desc" } });
  for (const event of events) {
    const payload = decodeOutboxEmailPayload(event);
    if (payload.to.toLowerCase() !== email) continue;
    process.stdout.write(`/verificar-email/${payload.rawToken}${payload.returnTo ? `?retorno=${encodeURIComponent(payload.returnTo)}` : ""}`);
    return;
  }
  throw new Error(`Nenhum e-mail de confirmação para ${email}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
