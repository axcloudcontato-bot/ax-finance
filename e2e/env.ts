/**
 * Banco próprio dos testes de ponta a ponta (ax_finance_e2e): nunca o de desenvolvimento nem o dos
 * testes de integração, que é zerado a cada teste. As URLs saem das de teste do .env (ou do ambiente
 * do CI), trocando só o nome do banco.
 */
try {
  process.loadEnvFile(".env");
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}

function withDatabase(url: string | undefined, database: string): string {
  if (!url) throw new Error("TEST_DATABASE_URL/TEST_APP_DATABASE_URL não configuradas (.env local ou ambiente do CI)");
  const parsed = new URL(url);
  parsed.pathname = `/${database}`;
  return parsed.toString();
}

export const E2E_DATABASE = "ax_finance_e2e";
export const E2E_DATABASE_URL = process.env.E2E_DATABASE_URL ?? withDatabase(process.env.TEST_DATABASE_URL, E2E_DATABASE);
export const E2E_APP_DATABASE_URL = process.env.E2E_APP_DATABASE_URL ?? withDatabase(process.env.TEST_APP_DATABASE_URL, E2E_DATABASE);
export const E2E_PORT = Number(process.env.E2E_PORT || 3100);
export const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;

/** Chave da outbox nos testes: o servidor (em modo produção no CI) cifra o e-mail de confirmação e o
    script de apoio decifra com a mesma chave para achar o link. Nunca usada fora do banco de E2E. */
export const E2E_OUTBOX_ENCRYPTION_KEY = "e2e-outbox-key-somente-para-testes";
