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

  it("trial vencido sem assinatura na Stripe bloqueia; trial em curso ou com assinatura da Stripe não", () => {
    const trial = (trialEndsAt: Date | null, stripeSubscriptionId: string | null = null) => ({
      status: "TRIAL",
      cancellationEffectiveAt: null,
      trialEndsAt,
      stripeSubscriptionId,
    });
    expect(writeBlockReason(trial(new Date("2026-10-03T11:59:59Z")), NOW)).toBe("TRIAL_ENDED");
    expect(writeBlockReason(trial(new Date("2026-10-03T12:00:00Z")), NOW)).toBe("TRIAL_ENDED");
    expect(writeBlockReason(trial(new Date("2026-10-03T12:00:01Z")), NOW)).toBeNull();
    expect(writeBlockReason(trial(null), NOW)).toBeNull();
    // Trial da própria Stripe: quem decide é o provedor (o webhook pode demorar a chegar).
    expect(writeBlockReason(trial(new Date("2026-09-01T00:00:00Z"), "sub_123"), NOW)).toBeNull();
  });

  it("outros estados ignoram a data do trial", () => {
    const past = new Date("2026-09-01T00:00:00Z");
    for (const status of ["ACTIVE", "PAYMENT_PENDING", "GRACE_PERIOD"]) {
      expect(writeBlockReason({ status, cancellationEffectiveAt: null, trialEndsAt: past, stripeSubscriptionId: null }, NOW)).toBeNull();
    }
  });

  it("conta interna nunca é bloqueada, em qualquer estado", () => {
    const past = new Date("2026-09-01T00:00:00Z");
    for (const status of ["SUSPENDED", "CANCELLED", "TRIAL", "CANCELLATION_SCHEDULED"]) {
      expect(
        writeBlockReason({ status, cancellationEffectiveAt: past, trialEndsAt: past, stripeSubscriptionId: null, billingExempt: true }, NOW)
      ).toBeNull();
    }
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

  it("trial vencido bloqueia, assinar ou estender o trial libera, e quem tem trial da Stripe não é bloqueado pela data", async () => {
    const { user, company, category } = await setup("trial");
    const day = 24 * 60 * 60 * 1000;
    const trialUntil = (when: number, stripeSubscriptionId: string | null = null) =>
      rootClient.subscription.update({
        where: { companyId: company.id },
        data: { status: "TRIAL", trialEndsAt: new Date(when), stripeSubscriptionId },
      });

    await trialUntil(Date.now() + 3 * day);
    await expect(createTitle(user.id, company.id, titleInput(category.id, "no trial"))).resolves.toBeDefined();

    await trialUntil(Date.now() - 1000);
    await expect(createTitle(user.id, company.id, titleInput(category.id, "vencido"))).rejects.toThrow(/período de avaliação desta empresa terminou/);
    // Leitura e exportação seguem liberadas.
    expect((await listTitles(user.id, company.id)).length).toBe(1);
    expect((await buildCompanyFinalExport(user.id, company.id)).titles).toHaveLength(1);

    // O proprietário (ou o suporte) estende o trial: libera de novo.
    await trialUntil(Date.now() + 7 * day);
    await expect(createTitle(user.id, company.id, titleInput(category.id, "estendido"))).resolves.toBeDefined();

    // Trial da Stripe com data vencida: o provedor decide, não a data.
    await trialUntil(Date.now() - day, "sub_stripe");
    await expect(createTitle(user.id, company.id, titleInput(category.id, "trial stripe"))).resolves.toBeDefined();

    // Assinatura paga libera mesmo com a data do trial no passado.
    await rootClient.subscription.update({ where: { companyId: company.id }, data: { status: "ACTIVE", stripeSubscriptionId: null } });
    await expect(createTitle(user.id, company.id, titleInput(category.id, "ativa"))).resolves.toBeDefined();
  });

  it("conta interna segue gravando suspensa, cancelada ou com o trial vencido", async () => {
    const { user, company, category } = await setup("interna");
    await rootClient.subscription.update({
      where: { companyId: company.id },
      data: { billingExempt: true, status: "CANCELLED", trialEndsAt: new Date(Date.now() - 86_400_000) },
    });
    await expect(createTitle(user.id, company.id, titleInput(category.id, "interna"))).resolves.toBeDefined();

    await rootClient.subscription.update({ where: { companyId: company.id }, data: { billingExempt: false } });
    await expect(createTitle(user.id, company.id, titleInput(category.id, "comum"))).rejects.toBeInstanceOf(SubscriptionWriteBlockedError);
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
