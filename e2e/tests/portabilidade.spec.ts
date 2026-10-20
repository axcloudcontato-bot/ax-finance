import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

test("patrimônio explica a composição e a assinatura entrega ZIP e JSON", async ({ page }, info) => {
  await page.goto("/patrimonio");
  await expect(page.getByRole("heading", { name: "Composição dos direitos e obrigações" })).toBeVisible();
  await page.locator("#composicao-titulos summary").first().click();
  await expect(page.locator("#composicao-titulos details").first()).toHaveAttribute("open", "");
  await page.screenshot({ path: info.outputPath("patrimonio-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole("heading", { name: "Patrimônio", exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath("patrimonio-mobile.png"), fullPage: true });
  await page.locator("#composicao-titulos").screenshot({ path: info.outputPath("patrimonio-composicao-mobile.png") });
  await page.goto("/configuracoes/assinatura");
  const downloaded = page.waitForEvent("download");
  await page.getByRole("link", { name: "Baixar pacote completo", exact: true }).click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toMatch(/ax-finance-export-.*\.zip$/);
  const output = info.outputPath("empresa.zip");
  await download.saveAs(output);
  expect(await download.failure()).toBeNull();
  expect((await readFile(output)).subarray(0, 2).toString()).toBe("PK");
  const response = await page.request.get("/api/exports/company");
  expect(response.ok()).toBe(true);
  const data = await response.json();
  expect(data.version).toBe(2);
  for (const key of ["debts", "assets", "savingsGoals", "reportSnapshots", "categoryRules"]) expect(Array.isArray(data[key])).toBe(true);
});
