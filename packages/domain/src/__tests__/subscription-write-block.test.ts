import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { registerUser } from "../identity/register";
import { createCompany } from "../companies/create-company";
import { createFinancialAccount } from "../financial-accounts/create-account";
import { createCategory } from "../categories/create-category";
import { createTitle } from "../titles/create-title";
import { listTitles } from "../titles/list-titles";
import { registerSettlement } from "../titles/register-settlement";
import { createRecurrenceRule } from "../recurrences/create-recurrence-rule";
import { generateDueOccurrences } from "../recurrences/generate-due-occurrences";
import { buildCompanyFinalExport } from "../exports/company-export";
import { getCompanySubscription, scheduleSubscriptionCancellation } from "../subscriptions/subscriptions";
import { writeBlockReason } from "../subscriptions/write-access";
import { resetCompanyLedger } from "../companies/reset-company-ledger";
import { SubscriptionWriteBlockedError } from "../errors";
import { rootClient, resetDatabase } from "./test-db";

const NOW = new Date("2026-10-03T12:00:00Z");

describe("writeBlockReason", () => {
  const sub = (status: string, cancellationEffectiveAt: Date | null = null) => ({ status, cancellationEffectiveAt });

  it("bloqueia só suspensa e encerrada; pagamento pendente e carência apenas avisam", () => {
    expect(writeBlockReason(sub("SUSPENDED"), NOW)).toBe("SUSPENDED");
    expect(writeBlockReason(sub("CANCELLED"), NOW)).toBe("ENDED");
    for (const status of ["TRIAL", "ACTIVE", "PAYMENT_PENDING", "GRACE_PERIOD"]) {
      expect(writeBlockReason(sub(status), NOW)).toBeNull();
    }
  });

  it("cancelamento agendado só bloqueia depois da data efetiva", () => {
    expect(writeBlockReason(sub("CANCELLATION_SCHEDULED", new Date("2026-10-10T00:00:00Z")), NOW)).toBeNull();
    expect(writeBlockReason(sub("CANCELLATION_SCHEDULED", new Date("2026-10-03T12:00:00Z")), NOW)).toBe("ENDED");
    expect(writeBlockReason(sub("CANCELLATION_SCHEDULED", new Date("2026-09-01T00:00:00Z")), NOW)).toBe("ENDED");
    expect(writeBlockReason(sub("CANCELLATION_SCHEDULED", null), NOW)).toBeNull();
  });

  it("empresa sem registro de assinatura segue liberada", () => {
    expect(writeBlockReason(null, NOW)).toBeNull();
  });
});

async function setup(label: string) {
  const user = await registerUser({ email: `${label}.${randomUUID()}@teste.ax.finance`, name: `Dona ${label}`, password: "senha-forte-123" });
  const company = await createCompany(user.id, { name: `Empresa ${label}` });
  const account = await createFinancialAccount(user.id, company.id, {
    name: "Conta",
    type: "BANK",
    openingBalanceCents: 0,
    openingDate: "2026-01-01",
  });
  const category = await createCategory(user.id, company.id, { name: "Serviços", nature: "OPERATING_REVENUE" });
  return { user, company, account, category };
}

function setStatus(companyId: string, status: string, cancellationEffectiveAt: Date | null = null) {
  return rootClient.subscription.update({
    where: { companyId },
    data: { status: status as never, cancellationEffectiveAt },
  });
}

const titleInput = (categoryId: string, description = "Serviço") => ({
  type: "RECEIVABLE" as const,
  description,
  categoryId,
  originalAmountCents: 10_000,
  competenceDate: "2026-10-01",
  dueDate: "2026-10-10",
});

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await rootClient.$disconnect();
});

describe("suspensa para escrita", () => {
  it("com a assinatura suspensa bloqueia criar, baixar e cadastrar, mas deixa ver, exportar e regularizar", async () => {
    const { user, company, account, category } = await setup("suspensa");
    const title = await createTitle(user.id, company.id, titleInput(category.id));

    await setStatus(company.id, "SUSPENDED");

    // Escritas de cada família de permissão são recusadas com a mensagem de regularização.
    await expect(createTitle(user.id, company.id, titleInput(category.id, "Novo"))).rejects.toBeInstanceOf(SubscriptionWriteBlockedError);
    await expect(
      registerSettlement(user.id, company.id, title.id, { financialAccountId: account.id, principalAmountCents: 10_000, effectiveDate: "2026-10-03" })
    ).rejects.toBeInstanceOf(SubscriptionWriteBlockedError);
    await expect(createCategory(user.id, company.id, { name: "Outra", nature: "COST" })).rejects.toThrow(/suspensa por falta de pagamento/);

    // Leitura, exportação e cobrança continuam disponíveis.
    expect(await listTitles(user.id, company.id)).toHaveLength(1);
    const exported = await buildCompanyFinalExport(user.id, company.id);
    expect(exported.format).toBe("ax-finance-company-export");
    expect(exported.titles).toHaveLength(1);
    expect((await getCompanySubscription(user.id, company.id))?.status).toBe("SUSPENDED");
    await expect(scheduleSubscriptionCancellation(user.id, company.id)).resolves.toBeDefined();
  });

  it("regularizar a assinatura libera a escrita de novo", async () => {
    const { user, company, category } = await setup("regulariza");
    await setStatus(company.id, "SUSPENDED");
    await expect(createTitle(user.id, company.id, titleInput(category.id))).rejects.toBeInstanceOf(SubscriptionWriteBlockedError);

    await setStatus(company.id, "ACTIVE");
    await expect(createTitle(user.id, company.id, titleInput(category.id))).resolves.toBeDefined();
  });

  it("pagamento pendente e carência continuam gravando", async () => {
    const { user, company, category } = await setup("pendente");
    for (const status of ["PAYMENT_PENDING", "GRACE_PERIOD"]) {
      await setStatus(company.id, status);
      await expect(createTitle(user.id, company.id, titleInput(category.id, `em ${status}`))).resolves.toBeDefined();
    }
  });

  it("cancelamento agendado grava até a data efetiva e bloqueia depois dela", async () => {
    const { user, company, category } = await setup("agendado");
    const day = 24 * 60 * 60 * 1000;

    await setStatus(company.id, "CANCELLATION_SCHEDULED", new Date(Date.now() + 5 * day));
    await expect(createTitle(user.id, company.id, titleInput(category.id, "antes"))).resolves.toBeDefined();

    await setStatus(company.id, "CANCELLATION_SCHEDULED", new Date(Date.now() - day));
    await expect(createTitle(user.id, company.id, titleInput(category.id, "depois"))).rejects.toThrow(/encerrada/);
  });

  it("a rotina de recorrências para em silêncio, sem lançar erro, e o dono ainda pode zerar a conta", async () => {
    const { user, company, category } = await setup("recorrencia");
    const today = new Date().toISOString().slice(0, 10);
    await createRecurrenceRule(user.id, company.id, {
      type: "PAYABLE",
      description: "Aluguel",
      categoryId: category.id,
      amountCents: 100_000,
      dayOfMonth: Number(today.slice(8, 10)),
      startDate: today,
    });

    await setStatus(company.id, "SUSPENDED");
    expect(await generateDueOccurrences(user.id, company.id)).toEqual({ createdCount: 0 });
    expect(await listTitles(user.id, company.id)).toHaveLength(0);

    await setStatus(company.id, "ACTIVE");
    expect((await generateDueOccurrences(user.id, company.id)).createdCount).toBeGreaterThan(0);

    await setStatus(company.id, "SUSPENDED");
    await expect(resetCompanyLedger(user.id, company.id, { confirmation: company.name })).resolves.toBeDefined();
  });
});
