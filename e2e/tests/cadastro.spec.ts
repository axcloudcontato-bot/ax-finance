import { execSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { E2E_APP_DATABASE_URL, E2E_DATABASE_URL, E2E_OUTBOX_ENCRYPTION_KEY } from "../env";

// Visitante sem sessão: o cadastro começa deslogado.
test.use({ storageState: { cookies: [], origins: [] } });

/** Link do e-mail de confirmação, lido da outbox como o worker faria. */
function verificationLink(email: string): string {
  return execSync(`pnpm exec tsx e2e/verification-link.ts ${email}`, {
    env: { ...process.env, DATABASE_URL: E2E_DATABASE_URL, APP_DATABASE_URL: E2E_APP_DATABASE_URL, OUTBOX_ENCRYPTION_KEY: E2E_OUTBOX_ENCRYPTION_KEY },
    encoding: "utf8",
  }).trim();
}

test("cadastro pelo site: aponta o campo errado, cria a conta, confirma o e-mail e abre o onboarding do plano", async ({ page }) => {
  const email = `cadastro.${Date.now()}@teste.ax.finance`;
  const password = "senha-cadastro-e2e-123";

  await page.goto("/registro?plano=PERSONAL");
  await expect(page.getByRole("heading", { name: "Criar sua conta" })).toBeVisible();

  // O navegador aceita "nome@dominio" sem ".com"; o servidor recusa e diz qual campo corrigir.
  await page.getByLabel("Nome").fill("Pessoa Cadastro");
  await page.getByLabel("E-mail").fill("pessoa@gmail");
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Confira o e-mail" })).toBeVisible();
  await expect(page.getByLabel("E-mail")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Nome")).toHaveValue("Pessoa Cadastro");
  await expect(page).not.toHaveURL(/pessoa/);

  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL(/\/login\?cadastrado=1/);
  await expect(page.getByRole("status").first()).toContainText("Enviamos um e-mail");

  const link = verificationLink(email);
  expect(link).toContain(`retorno=${encodeURIComponent("/onboarding?plano=PERSONAL")}`);
  await page.goto(link);
  await page.getByRole("button", { name: "Confirmar meu e-mail" }).click();
  await expect(page).toHaveURL(/\/login\?emailVerificado=1/);

  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/onboarding\?plano=PERSONAL/);
  await expect(page.getByRole("heading", { name: "Vamos configurar sua gestão" })).toBeVisible();
  await expect(page.locator('input[name="planCode"][value="PERSONAL"]')).toBeChecked();
});
