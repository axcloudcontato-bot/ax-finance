// Testes de integração rodam contra o banco de TESTE (ax_finance_test), nunca
// o de desenvolvimento — troca a variável antes de qualquer módulo importar
// @ax-finance/db (que lê APP_DATABASE_URL no momento em que o client é criado).
process.loadEnvFile(new URL("./.env", import.meta.url));

if (!process.env.TEST_APP_DATABASE_URL || !process.env.TEST_DATABASE_URL) {
  throw new Error("TEST_APP_DATABASE_URL/TEST_DATABASE_URL não configuradas no .env");
}

process.env.APP_DATABASE_URL = process.env.TEST_APP_DATABASE_URL;
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
