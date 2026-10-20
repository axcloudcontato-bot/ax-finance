import { expect, test, type Page } from "@playwright/test";
import { E2E_DATABASE_URL } from "../env";
import { E2E_ACCOUNT, E2E_USER } from "../fixtures";

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
async function open(page: Page, label: string) {
  await page.getByRole("button", { name: label, exact: true }).click();
  return page.getByRole("dialog").last();
}
function metric(page: Page, label: string) {
  return page.locator(".workspace-metric").filter({ has: page.locator(".workspace-metric-label", { hasText: label }) }).locator("strong");
}
async function accountBalance(page: Page) {
  await page.goto("/contas");
  const text = await page.getByRole("row").filter({ has: page.getByRole("button", { name: E2E_ACCOUNT, exact: true }) }).locator("td.money").last().innerText();
  return Math.round(Number(text.replace(/[^\d,-]/g, "").replace(",", ".")) * 100);
}

test("compra parcelada, cadastros sobrepostos, antecipação, fechamento, pagamento e estornos", async ({ page }, info) => {
  test.setTimeout(180000);
  const baseline = await accountBalance(page);
  const suffix = Date.now().toString();
  await page.goto("/cartoes");
  const cardForm = await open(page, "+ Novo cartão");
  await cardForm.getByLabel("Apelido do cartão").fill(`Cartão ciclo ${suffix}`);
  await cardForm.getByLabel("Limite total (R$)").fill("2000");
  await cardForm.getByLabel("Dia do fechamento").fill("1");
  await cardForm.getByLabel("Dia do vencimento").fill("10");
  await cardForm.getByLabel("Conta que costuma pagar a fatura (opcional)").selectOption({ label: E2E_ACCOUNT });
  await cardForm.getByRole("button", { name: "Criar cartão", exact: true }).click();
  await expect(page).toHaveURL(/\/cartoes\/[a-f0-9-]+\?novo=1/);
  const cardUrl = page.url().split("?")[0]!;
  const purchase = await open(page, "+ Nova compra");
  await purchase.getByLabel("Descrição", { exact: true }).fill(`Compra preservada ${suffix}`);
  await purchase.getByLabel("Valor total (R$)").fill("200");
  await purchase.getByLabel("Parcelas", { exact: true }).fill("2");
  await purchase.getByRole("button", { name: "+ Nova categoria", exact: true }).click();
  const category = page.getByRole("dialog").last();
  await category.getByLabel("Nome", { exact: true }).fill(`Categoria ${suffix}`);
  await category.getByRole("button", { name: "Criar categoria", exact: true }).click();
  await expect(purchase.getByLabel("Categoria", { exact: true }).locator("option:checked")).toHaveText(`Categoria ${suffix}`);
  await purchase.getByRole("button", { name: "+ Novo estabelecimento", exact: true }).click();
  const party = page.getByRole("dialog").last();
  await party.getByLabel("Nome", { exact: true }).fill(`Loja ${suffix}`);
  await party.getByRole("button", { name: "Cadastrar estabelecimento", exact: true }).click();
  await expect(purchase.getByLabel("Descrição", { exact: true })).toHaveValue(`Compra preservada ${suffix}`);
  await expect(purchase.getByLabel("Valor total (R$)")).toHaveValue("200,00");
  await purchase.getByRole("button", { name: "Lançar compra", exact: true }).click();
  await expect(page.getByText("Compra lançada na fatura.", { exact: true })).toBeVisible();
  await expect(metric(page, "Limite disponível")).toHaveText(money(180000));
  await page.getByRole("link", { name: "Abrir", exact: true }).first().click();
  await expect(page).toHaveURL(/\/cartoes\/[a-f0-9-]+\/faturas\/[a-f0-9-]+$/);
  const invoiceUrl = page.url();
  const invoiceId = invoiceUrl.split("/").pop()!;
  const anticipation = await open(page, "Antecipar fatura");
  await anticipation.getByLabel("Valor a antecipar (R$)").fill("30");
  await anticipation.getByRole("button", { name: "Antecipar", exact: true }).click();
  await expect(page.getByText(/Antecipação registrada/)).toBeVisible();
  expect(await accountBalance(page)).toBe(baseline - 3000);
  await page.goto(cardUrl);
  await expect(metric(page, "Limite disponível")).toHaveText(money(183000));

  // Avança somente o ciclo da fatura fictícia no banco dedicado, sem alterar
  // o relógio do sistema nem criar uma rota de teste na aplicação.
  if (new URL(E2E_DATABASE_URL).pathname !== "/ax_finance_e2e") throw new Error("Banco de E2E obrigatório.");
  const { PrismaClient } = await import("@ax-finance/db");
  const db = new PrismaClient({ datasourceUrl: E2E_DATABASE_URL });
  try {
    const owner = await db.user.findUniqueOrThrow({ where: { email: E2E_USER.email } });
    const invoice = await db.creditCardInvoice.findUniqueOrThrow({ where: { id: invoiceId } });
    await db.membership.findFirstOrThrow({ where: { userId: owner.id, companyId: invoice.companyId, role: "OWNER" } });
    await db.creditCardInvoice.update({ where: { id: invoiceId }, data: { closingDate: new Date(today()) } });
  } finally { await db.$disconnect(); }
  await page.goto(invoiceUrl);
  const payment = await open(page, "Registrar pagamento");
  await expect(payment.getByLabel("Principal pago da fatura (R$)")).toHaveValue("70,00");
  await payment.getByRole("button", { name: "Registrar pagamento", exact: true }).click();
  await expect(page.getByText("Pagamento registrado.", { exact: true })).toBeVisible();
  expect(await accountBalance(page)).toBe(baseline - 10000);
  await page.goto(cardUrl);
  await expect(metric(page, "Limite disponível")).toHaveText(money(190000));
  await page.goto(invoiceUrl);
  for (const kind of ["pagamento", "antecipação"]) {
    // Os dois pagamentos têm o mesmo dia; o menu identifica a operação.
    for (const button of await page.getByRole("button", { name: "Gerenciar", exact: true }).all()) {
      await button.click();
      if (await page.getByRole("button", { name: `Estornar ${kind}`, exact: true }).isVisible()) break;
      await page.keyboard.press("Escape");
    }
    const reversal = await open(page, `Estornar ${kind}`);
    await reversal.getByLabel("Motivo", { exact: true }).fill("Conferência E2E");
    await reversal.getByRole("button", { name: `Estornar ${kind}`, exact: true }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByText(/Estorno registrado/)).toBeVisible();
  }
  expect(await accountBalance(page)).toBe(baseline);
  await page.goto(cardUrl);
  await expect(metric(page, "Limite disponível")).toHaveText(money(180000));
  await page.goto(invoiceUrl);
  await expect(page.getByRole("cell", { name: "Estornado: Conferência E2E", exact: true })).toHaveCount(2);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole("heading", { level: 1 }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath("fatura-estornos-mobile.png"), fullPage: true, animations: "disabled" });
});
