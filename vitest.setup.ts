// Testes de integração rodam contra o banco de TESTE (ax_finance_test), nunca
// o de desenvolvimento — troca a variável antes de qualquer módulo importar
// @ax-finance/db (que lê APP_DATABASE_URL no momento em que o client é criado).
// Localmente as variáveis vêm do .env; no CI não há .env e elas chegam pelo ambiente do job.
try {
  process.loadEnvFile(new URL("./.env", import.meta.url));
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}

if (!process.env.TEST_APP_DATABASE_URL || !process.env.TEST_DATABASE_URL) {
  throw new Error("TEST_APP_DATABASE_URL/TEST_DATABASE_URL não configuradas (.env local ou ambiente do CI)");
}

process.env.APP_DATABASE_URL = process.env.TEST_APP_DATABASE_URL;
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
