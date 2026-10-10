import { expect, test as setup } from "@playwright/test";
import { E2E_USER } from "../fixtures";

/** Entra uma vez e guarda a sessão para os demais testes. */
setup("login", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(E2E_USER.email);
  await page.getByLabel("Senha", { exact: true }).fill(E2E_USER.password);
  await page.getByRole("button", { name: /Entrar na minha conta/ }).click();
  await expect(page).toHaveURL(/\/(painel|dashboard)/);
  await page.context().storageState({ path: "e2e/.auth/user.json" });
});
