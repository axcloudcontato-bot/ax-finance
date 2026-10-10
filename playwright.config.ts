import { defineConfig, devices } from "@playwright/test";
import { E2E_APP_DATABASE_URL, E2E_BASE_URL, E2E_DATABASE_URL, E2E_PORT } from "./e2e/env";

/**
 * Testes de ponta a ponta: o app de verdade, num navegador de verdade, contra o banco ax_finance_e2e.
 * Pegam o que os testes de integração não pegam (server actions, formulários, máscara de valor,
 * redirecionamentos). `pnpm e2e` sobe o app sozinho na porta 3100; no CI ele roda já compilado.
 */
export default defineConfig({
  testDir: "./e2e/tests",
  globalSetup: "./e2e/global-setup.ts",
  // os testes compartilham a mesma conta e o mesmo banco: um de cada vez
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never", outputFolder: "e2e/report" }]] : [["list"]],
  outputDir: "e2e/results",
  use: {
    baseURL: E2E_BASE_URL,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    navigationTimeout: 60_000,
    actionTimeout: 20_000,
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    { name: "chromium", use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/user.json" }, dependencies: ["setup"] },
  ],
  webServer: {
    command: process.env.E2E_SERVER_COMMAND ?? `pnpm --filter web exec next dev -p ${E2E_PORT}`,
    url: `${E2E_BASE_URL}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env: {
      DATABASE_URL: E2E_DATABASE_URL,
      APP_DATABASE_URL: E2E_APP_DATABASE_URL,
      APP_BASE_URL: E2E_BASE_URL,
      COOKIE_SECURE: "false",
    },
  },
});
