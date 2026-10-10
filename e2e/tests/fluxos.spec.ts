import { expect, test, type Page } from "@playwright/test";
import { E2E_ACCOUNT } from "../fixtures";

/** Data de hoje no fuso do app, no formato do campo de data. */
function today(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

/**
 * Abre um modal pelo botão. Repete o clique até o modal aparecer: no servidor de desenvolvimento a
 * página pode ser clicada antes de o React terminar de carregar, e esse primeiro clique se perde.
 */
async function openModal(page: Page, trigger: string | RegExp) {
  const dialog = page.getByRole("dialog");
  await expect(async () => {
    if (!(await dialog.isVisible())) await page.getByRole("button", { name: trigger }).first().click();
    await expect(dialog).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 60_000 });
  return dialog;
}

test.describe("fluxos principais", () => {
  test("painel abre com o saldo da conta", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByText("Disponível na empresa")).toBeVisible();
    await expect(page.getByText("R$ 1.000,00").first()).toBeVisible();
  });

  test("lança uma entrada e registra o recebimento", async ({ page }) => {
    await page.goto("/entradas");
    const dialog = await openModal(page, "+ Novo lançamento");
    await dialog.locator("#qc-description").fill("Venda E2E balcão");
    await dialog.locator("#qc-category").selectOption({ label: "Vendas" });
    await dialog.locator("#qc-amount").fill("250");
    await dialog.locator("#qc-amount").blur();
    await expect(dialog.locator("#qc-amount")).toHaveValue("250,00"); // máscara de reais
    await dialog.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeHidden();

    const row = page.getByRole("row", { name: /Venda E2E balcão/ });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Receber" }).click();
    const settle = page.getByRole("dialog");
    await settle.getByLabel("Conta").selectOption({ label: E2E_ACCOUNT });
    await settle.getByRole("button", { name: "Confirmar recebimento" }).click();
    await expect(page.getByRole("row", { name: /Venda E2E balcão/ }).getByText("Quitado")).toBeVisible();
  });

  test("importa extrato e lança e concilia pela regra de categoria", async ({ page }) => {
    await page.goto("/conciliacao");
    const csv = `data,descricao,valor\n${today()},UBER *TRIP E2E,-23.90\n`;
    await page.locator('.concil-import input[type="file"]').setInputFiles({ name: "extrato-e2e.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
    await page.getByRole("button", { name: "Revisar arquivo" }).click();
    await expect(page).toHaveURL(/\/conciliacao\/importacoes\//);
    await page.getByRole("button", { name: "Confirmar importação" }).click();
    await expect(page.locator(".success-box").getByText(/1 importada/)).toBeVisible();

    await expect(page.getByText("Regra → Transporte")).toBeVisible();
    await page.getByRole("button", { name: /Lançar e conciliar esta/ }).click();
    await expect(page.getByText(/1 linha lançada e conciliada pelas regras/)).toBeVisible();
    await expect(page.getByRole("row", { name: /UBER \*TRIP E2E/ }).getByText("Conciliada")).toBeVisible();
  });

  test("cria um cofrinho, guarda e a barra enche", async ({ page }) => {
    await page.goto("/cofrinhos");
    const dialog = await openModal(page, "+ Novo cofrinho");
    await dialog.getByLabel("Nome do cofrinho").fill("Viagem E2E");
    await dialog.getByLabel("Meta (R$)").fill("1000");
    await dialog.getByLabel("Conta de onde costuma guardar (opcional)").selectOption({ label: E2E_ACCOUNT });
    await dialog.getByLabel(/Já quer guardar algum valor agora/).fill("100");
    await dialog.getByRole("button", { name: "Criar cofrinho" }).click();

    await expect(page.getByText("Cofrinho criado")).toBeVisible();
    await expect(page.locator(".goal-detail-percent strong")).toHaveText("10%");

    const deposit = await openModal(page, "Guardar");
    await deposit.getByLabel("Valor (R$)").fill("150");
    await deposit.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByText("Valor guardado.")).toBeVisible();
    await expect(page.locator(".goal-detail-percent strong")).toHaveText("25%");
  });
});
