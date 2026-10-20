import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { createCategory, createCompany, createFinancialAccount, createTitle, createTitleAttachment, registerSettlement, registerUser } from "@ax-finance/domain";
import { prisma } from "@ax-finance/db";

async function main() {
  if (process.env.CI !== "true" || !process.env.RESTORE_TEST_ATTACHMENTS) throw new Error("Este cenário só pode ser criado no CI isolado.");
  const user = await registerUser({ email: "restore@example.test", name: "Ensaio", password: "restore-test-password" });
  const company = await createCompany(user.id, { name: "Ensaio de restauração" });
  const category = await createCategory(user.id, company.id, { name: "Receita", nature: "OPERATING_REVENUE" });
  const account = await createFinancialAccount(user.id, company.id, { name: "Banco", type: "BANK", openingBalanceCents: 10000, openingDate: "2026-01-01" });
  const title = await createTitle(user.id, company.id, { type: "RECEIVABLE", description: "Venda preservada", categoryId: category.id, originalAmountCents: 5000, competenceDate: "2026-01-01", dueDate: "2026-01-10" });
  await registerSettlement(user.id, company.id, title.id, { financialAccountId: account.id, principalAmountCents: 2000, effectiveDate: "2026-01-10" });
  const id = randomUUID();
  const storageKey = `${company.id}/${title.id}/${id}`;
  const bytes = Buffer.from("%PDF-1.4\nEnsaio de integridade do anexo\n");
  const target = path.join(process.env.RESTORE_TEST_ATTACHMENTS, storageKey);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, bytes);
  await createTitleAttachment(user.id, company.id, title.id, { id, originalName: "ensaio.pdf", mimeType: "application/pdf", sizeBytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), storageKey });
}
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
