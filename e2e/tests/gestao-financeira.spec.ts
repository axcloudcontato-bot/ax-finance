import { expect, test, type Page } from "@playwright/test";
import { E2E_ACCOUNT } from "../fixtures";

const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
function day(offset: number) { const date = new Date(`${today}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + offset); return date.toISOString().slice(0, 10); }
const previous = new Date(`${today.slice(0, 7)}-01T00:00:00Z`); previous.setUTCDate(0);
const month = previous.toISOString().slice(0, 7);
const monthLabel = previous.toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
const monthName = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
async function modal(page: Page, name: string) {
  const dialog = page.getByRole("dialog");
  await expect(async () => { if (!await dialog.isVisible()) await page.getByRole("button", { name, exact: true }).first().click(); await expect(dialog).toBeVisible({ timeout: 3000 }); }).toPass({ timeout: 60000 });
  return dialog;
}

test.describe.serial("gestão financeira: histórico, caixa e margem", () => {
  test("salva promessa e probabilidade em modal amplo, simula atraso e reserva no desktop e celular", async ({ page }, info) => {
    const clientErrors: string[] = [];
    page.on("pageerror", (error) => clientErrors.push(error.message));
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`/entradas?mes=${month}`);
    const form = await modal(page, "+ Novo lançamento");
    await form.locator("#qc-description").fill("Venda previsão E2E");
    await form.locator("#qc-category").selectOption({ label: "Vendas" });
    await form.locator("#qc-amount").fill("500");
    await form.locator("#qc-competence").fill(`${month}-05`);
    await form.locator("#qc-due").fill(`${month}-05`);
    await form.getByRole("button", { name: "Salvar entrada", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await page.getByRole("link", { name: "Venda previsão E2E", exact: true }).click();
    const plan = await modal(page, "Planejar recebimento");
    await expect(plan).toBeVisible();
    await expect.poll(async () => (await plan.boundingBox())?.width ?? 0).toBeGreaterThan(700);
    await plan.getByLabel("Data provável de recebimento").fill(day(2));
    await plan.getByLabel("Data prometida pelo cliente").fill(day(4));
    await plan.getByLabel("Probabilidade estimada de recebimento (%)").fill("80");
    await plan.getByLabel("Conta prevista").selectOption({ label: E2E_ACCOUNT });
    await page.screenshot({ path: info.outputPath("previsao-modal-desktop.png") });
    await plan.getByRole("button", { name: "Salvar previsão" }).click();
    await expect(page.getByText("80% de probabilidade estimada")).toBeVisible();
    await page.goto("/relatorios/fluxo-de-caixa");
    const reserve = await modal(page, "Definir reserva mínima");
    await reserve.getByLabel("Reserva mínima (R$)").fill("2000");
    await reserve.getByRole("button", { name: "Salvar reserva" }).click();
    await expect(page.getByText("Reserva mínima atualizada.")).toBeVisible();
    await page.getByLabel("Simular atraso dos recebimentos (dias)").fill("7");
    await page.getByRole("button", { name: "Simular", exact: true }).click();
    await expect(page.getByText("Saldo com atraso de 7 dias", { exact: true })).toBeVisible();
    await expect(page.getByText(/Reserva comprometida em/)).toBeVisible();
    await page.getByText("Conferir datas e ajustar recebimentos", { exact: true }).click();
    await expect(page.getByRole("row", { name: /Venda previsão E2E/ })).toContainText("Promessa de pagamento");
    await page.screenshot({ path: info.outputPath("fluxo-desktop.png"), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: info.outputPath("fluxo-mobile.png"), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    expect(clientErrors).toEqual([]);
  });

  test("fecha, preserva carteira após recebimento e cria nova versão depois de reabrir", async ({ page }) => {
    await page.goto("/fechamento");
    const period = page.getByRole("row").filter({ hasText: monthName });
    await period.getByRole("button", { name: "Fechar", exact: true }).click();
    await expect(page.getByText(`Período ${month} fechado.`)).toBeVisible();
    await page.getByRole("link", { name: "Carteira", exact: true }).first().click();
    await expect(page.getByText(/Carteira preservada do mês/)).toBeVisible();
    const historyUrl = page.url();
    await expect(page.getByRole("row", { name: /Venda previsão E2E/ })).toBeVisible();
    await page.goto(`/entradas?mes=${month}`);
    await page.getByRole("row", { name: /Venda previsão E2E/ }).getByRole("button", { name: "Receber", exact: true }).click();
    const receive = page.getByRole("dialog");
    await receive.getByLabel("Conta", { exact: true }).selectOption({ label: E2E_ACCOUNT });
    await receive.getByRole("button", { name: "Confirmar recebimento" }).click();
    await expect(page.getByRole("row", { name: /Venda previsão E2E/ }).getByText("Quitado")).toBeVisible();
    await page.goto(historyUrl);
    await expect(page.getByRole("row", { name: /Venda previsão E2E/ })).toBeVisible();
    await page.goto("/fechamento");
    await period.getByPlaceholder("Motivo da reabertura").fill("Revisão E2E");
    await period.getByRole("button", { name: "Reabrir", exact: true }).click();
    await expect(page.getByText(`Período ${month} reaberto.`)).toBeVisible();
    await period.getByRole("button", { name: "Fechar", exact: true }).click();
    await expect(page.getByText("Fechamento · 2", { exact: true })).toBeVisible();
    await expect(page.getByText("Fechamento · 1", { exact: true })).toBeVisible();
  });

  test("classifica comportamento de gasto e consulta rentabilidade preservada", async ({ page }, info) => {
    await page.goto("/cadastros/categorias");
    const row = page.getByRole("row", { name: /Transporte/ });
    await row.getByRole("button", { name: "Gerenciar", exact: true }).click();
    const edit = await modal(page, "Editar");
    await edit.getByLabel("Comportamento do gasto").selectOption("VARIABLE");
    await edit.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page.getByText("Categoria atualizada.")).toBeVisible();
    await page.goto("/fechamento");
    await page.getByRole("main").getByRole("link", { name: "Rentabilidade", exact: true }).first().click();
    await expect(page.getByRole("heading", { name: "Rentabilidade por projeto ou serviço" })).toBeVisible();
    await expect(page.getByText(/Versão preservada em/)).toBeVisible();
    await page.getByLabel("Gastos fixos sem centro").selectOption("REVENUE");
    await page.getByRole("button", { name: "Calcular", exact: true }).click();
    await expect(page.getByText(/Rateio gerencial pela participação/)).toBeVisible();
    await page.screenshot({ path: info.outputPath("rentabilidade-desktop.png"), fullPage: true });
    await page.getByRole("main").getByRole("link", { name: "DRE gerencial", exact: true }).click();
    await expect(page.getByText(/DRE preservada em/)).toBeVisible();
  });
});
