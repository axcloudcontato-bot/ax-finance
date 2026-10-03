import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@ax-finance/db";
import { registerUser } from "../identity/register";
import { createCompany } from "../companies/create-company";
import { listAuditEvents } from "../audit/list-audit-events";
import {
  applyStripeSubscriptionState,
  claimBillingEvent,
  finishBillingEvent,
  findBillingCompanyId,
  linkStripeCustomer,
} from "../billing/billing";
import { mapStripeSubscription, planCodeForPrice, type StripeSubscriptionSnapshot } from "../billing/stripe-state";
import { rootClient, resetDatabase } from "./test-db";

const CATALOG = { PERSONAL: "price_personal", ESSENTIAL: "price_essential" } as const;
const NOW = new Date("2026-10-03T12:00:00Z");
const epoch = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);

function snapshot(overrides: Partial<StripeSubscriptionSnapshot> = {}): StripeSubscriptionSnapshot {
  return {
    id: "sub_123",
    customerId: "cus_123",
    status: "active",
    cancelAtPeriodEnd: false,
    currentPeriodEnd: epoch("2026-11-03T12:00:00Z"),
    trialEnd: null,
    cancelAt: null,
    priceId: CATALOG.ESSENTIAL,
    companyHint: null,
    ...overrides,
  };
}

describe("mapStripeSubscription", () => {
  it("active → ACTIVE com o plano do preço e o fim do ciclo", () => {
    const state = mapStripeSubscription(snapshot(), CATALOG, NOW);
    expect(state).toMatchObject({ status: "ACTIVE", planCode: "ESSENTIAL", graceEndsAt: null, cancellationEffectiveAt: null });
    expect(state.currentPeriodEnd?.toISOString()).toBe("2026-11-03T12:00:00.000Z");
  });

  it("trialing → TRIAL com o fim do trial", () => {
    const state = mapStripeSubscription(snapshot({ status: "trialing", trialEnd: epoch("2026-10-10T00:00:00Z"), priceId: CATALOG.PERSONAL }), CATALOG, NOW);
    expect(state.status).toBe("TRIAL");
    expect(state.planCode).toBe("PERSONAL");
    expect(state.trialEndsAt?.toISOString()).toBe("2026-10-10T00:00:00.000Z");
  });

  it("cancel_at_period_end vira CANCELLATION_SCHEDULED até o fim do ciclo", () => {
    const state = mapStripeSubscription(snapshot({ cancelAtPeriodEnd: true }), CATALOG, NOW);
    expect(state.status).toBe("CANCELLATION_SCHEDULED");
    expect(state.cancellationEffectiveAt?.toISOString()).toBe("2026-11-03T12:00:00.000Z");
  });

  it("past_due → PAYMENT_PENDING com carência de 7 dias", () => {
    const state = mapStripeSubscription(snapshot({ status: "past_due" }), CATALOG, NOW);
    expect(state.status).toBe("PAYMENT_PENDING");
    expect(state.graceEndsAt?.toISOString()).toBe("2026-10-10T12:00:00.000Z");
  });

  it("unpaid → SUSPENDED e canceled → CANCELLED; estado desconhecido não libera acesso", () => {
    expect(mapStripeSubscription(snapshot({ status: "unpaid" }), CATALOG, NOW).status).toBe("SUSPENDED");
    expect(mapStripeSubscription(snapshot({ status: "canceled" }), CATALOG, NOW).status).toBe("CANCELLED");
    expect(mapStripeSubscription(snapshot({ status: "algo_novo" }), CATALOG, NOW).status).toBe("PAYMENT_PENDING");
  });

  it("preço desconhecido não altera o plano", () => {
    expect(mapStripeSubscription(snapshot({ priceId: "price_outro" }), CATALOG, NOW).planCode).toBeNull();
    expect(planCodeForPrice(null, CATALOG)).toBeNull();
  });
});

async function setupCompany(label: string) {
  const user = await registerUser({ email: `${label}.${randomUUID()}@teste.ax.finance`, name: `Dona ${label}`, password: "senha-forte-123" });
  const company = await createCompany(user.id, { name: `Empresa ${label}` });
  return { user, company };
}

async function readSubscription(companyId: string) {
  return rootClient.subscription.findUniqueOrThrow({ where: { companyId } });
}

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await rootClient.$disconnect();
  await prisma.$disconnect();
});

describe("webhooks de cobrança (Stripe)", () => {
  it("reserva cada evento uma vez e permite repetir só o que não terminou", async () => {
    expect(await claimBillingEvent("evt_1", "customer.subscription.updated")).toBe(true);
    // Reentrega enquanto a primeira tentativa ainda não terminou: pode tentar de novo.
    expect(await claimBillingEvent("evt_1", "customer.subscription.updated")).toBe(true);

    await finishBillingEvent("evt_1", "FAILED", { message: "timeout" });
    expect(await claimBillingEvent("evt_1", "customer.subscription.updated")).toBe(true);

    await finishBillingEvent("evt_1", "PROCESSED");
    expect(await claimBillingEvent("evt_1", "customer.subscription.updated")).toBe(false);

    await finishBillingEvent("evt_2", "IGNORED");
    expect(await claimBillingEvent("evt_2", "invoice.paid")).toBe(true); // nunca reservado: vira novo
  });

  it("o role da aplicação não lê nem grava billing_events diretamente", async () => {
    await expect(prisma.$queryRaw`SELECT * FROM billing_events`).rejects.toThrow();
  });

  it("ativa a assinatura só com o estado do provedor, grava vínculos e audita", async () => {
    const { user, company } = await setupCompany("ativa");
    expect((await readSubscription(company.id)).status).toBe("TRIAL");

    const state = mapStripeSubscription(snapshot({ companyHint: company.id }), CATALOG, NOW);
    const companyId = await findBillingCompanyId({ customerId: "cus_123", subscriptionId: "sub_123", companyHint: company.id });
    expect(companyId).toBe(company.id);

    expect(await applyStripeSubscriptionState({ companyId: company.id, customerId: "cus_123", subscriptionId: "sub_123", state, observedAt: NOW })).toBe(true);

    const subscription = await readSubscription(company.id);
    expect(subscription).toMatchObject({
      status: "ACTIVE",
      planCode: "ESSENTIAL",
      stripeCustomerId: "cus_123",
      stripeSubscriptionId: "sub_123",
    });
    expect(subscription.currentPeriodEnd?.toISOString()).toBe("2026-11-03T12:00:00.000Z");

    // Depois do primeiro vínculo, a empresa é achada pelos ids da Stripe, sem dica.
    expect(await findBillingCompanyId({ customerId: "cus_123", subscriptionId: null, companyHint: null })).toBe(company.id);
    expect(await findBillingCompanyId({ customerId: "cus_x", subscriptionId: "sub_x", companyHint: null })).toBeNull();

    const events = await listAuditEvents(user.id, company.id, {});
    const synced = events.find((event) => event.eventType === "SUBSCRIPTION_BILLING_SYNCED");
    expect(synced?.actorName).toBe("Stripe");
    expect(synced?.summary).toContain("TRIAL → ACTIVE");
  });

  it("descarta estado lido antes de outro já aplicado (fora de ordem)", async () => {
    const { company } = await setupCompany("ordem");
    const base = { companyId: company.id, customerId: "cus_1", subscriptionId: "sub_1" };

    const newer = mapStripeSubscription(snapshot({ status: "active" }), CATALOG, NOW);
    const older = mapStripeSubscription(snapshot({ status: "past_due" }), CATALOG, NOW);

    expect(await applyStripeSubscriptionState({ ...base, state: newer, observedAt: new Date("2026-10-03T12:00:05Z") })).toBe(true);
    expect(await applyStripeSubscriptionState({ ...base, state: older, observedAt: new Date("2026-10-03T12:00:01Z") })).toBe(false);
    expect((await readSubscription(company.id)).status).toBe("ACTIVE");
  });

  it("preserva a carência enquanto o pagamento segue pendente e a limpa quando paga", async () => {
    const { company } = await setupCompany("carencia");
    const base = { companyId: company.id, customerId: "cus_1", subscriptionId: "sub_1" };

    const firstFailure = mapStripeSubscription(snapshot({ status: "past_due" }), CATALOG, NOW);
    await applyStripeSubscriptionState({ ...base, state: firstFailure, observedAt: NOW });
    const grace = (await readSubscription(company.id)).graceEndsAt;
    expect(grace?.toISOString()).toBe("2026-10-10T12:00:00.000Z");

    const laterFailure = mapStripeSubscription(snapshot({ status: "past_due" }), CATALOG, new Date("2026-10-05T12:00:00Z"));
    await applyStripeSubscriptionState({ ...base, state: laterFailure, observedAt: new Date("2026-10-05T12:00:00Z") });
    expect((await readSubscription(company.id)).graceEndsAt?.toISOString()).toBe(grace?.toISOString());

    const paid = mapStripeSubscription(snapshot({ status: "active" }), CATALOG, new Date("2026-10-06T12:00:00Z"));
    await applyStripeSubscriptionState({ ...base, state: paid, observedAt: new Date("2026-10-06T12:00:00Z") });
    expect(await readSubscription(company.id)).toMatchObject({ status: "ACTIVE", graceEndsAt: null });
  });

  it("não cria assinatura para empresa inexistente", async () => {
    const state = mapStripeSubscription(snapshot(), CATALOG, NOW);
    expect(await applyStripeSubscriptionState({ companyId: randomUUID(), customerId: "cus_9", subscriptionId: "sub_9", state })).toBe(false);
  });

  it("só o proprietário vincula o cliente da Stripe", async () => {
    const { user, company } = await setupCompany("cliente");
    await linkStripeCustomer(user.id, company.id, "cus_abc");
    expect((await readSubscription(company.id)).stripeCustomerId).toBe("cus_abc");

    const other = await registerUser({ email: `outro.${randomUUID()}@teste.ax.finance`, name: "Outro", password: "senha-forte-123" });
    await expect(linkStripeCustomer(other.id, company.id, "cus_zzz")).rejects.toThrow();
  });
});
