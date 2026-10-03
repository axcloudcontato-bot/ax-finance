import { randomUUID } from "node:crypto";
import Stripe from "stripe";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createCompany, registerUser } from "@ax-finance/domain";
import { rootClient, resetDatabase } from "../../../packages/domain/src/__tests__/test-db";
import { processStripeEvent, type SubscriptionReader } from "./stripe-webhook";
import { subscriptionIdFromEvent } from "./stripe";

const SECRET = "whsec_test_secret";
const NOW = new Date("2026-10-03T12:00:00Z");

process.env.STRIPE_PRICE_PERSONAL = "price_personal";
process.env.STRIPE_PRICE_ESSENTIAL = "price_essential";

function subscription(overrides: Record<string, unknown> = {}, companyId?: string) {
  return {
    id: "sub_1",
    customer: "cus_1",
    status: "active",
    cancel_at_period_end: false,
    cancel_at: null,
    trial_end: null,
    metadata: companyId ? { companyId } : {},
    items: { data: [{ current_period_end: Math.floor(new Date("2026-11-03T12:00:00Z").getTime() / 1000), price: { id: "price_essential" } }] },
    ...overrides,
  } as unknown as Stripe.Subscription;
}

function reader(sub: Stripe.Subscription): SubscriptionReader {
  return { subscriptions: { retrieve: async () => sub } };
}

function event(type: string, object: Record<string, unknown>) {
  return { id: `evt_${randomUUID()}`, type, data: { object } } as unknown as Stripe.Event;
}

async function setupCompany(label: string) {
  const user = await registerUser({ email: `${label}.${randomUUID()}@teste.ax.finance`, name: `Dona ${label}`, password: "senha-forte-123" });
  return createCompany(user.id, { name: `Empresa ${label}` });
}

describe("assinatura do webhook", () => {
  const payload = JSON.stringify({ id: "evt_1", object: "event", type: "invoice.paid" });

  it("aceita o corpo assinado e rejeita corpo alterado, segredo errado e assinatura antiga", () => {
    const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET });
    expect(Stripe.webhooks.constructEvent(payload, header, SECRET).id).toBe("evt_1");

    expect(() => Stripe.webhooks.constructEvent(payload + " ", header, SECRET)).toThrow();
    expect(() => Stripe.webhooks.constructEvent(payload, header, "whsec_outro")).toThrow();

    const old = Stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET, timestamp: Math.floor(Date.now() / 1000) - 3600 });
    expect(() => Stripe.webhooks.constructEvent(payload, old, SECRET)).toThrow();
  });
});

describe("subscriptionIdFromEvent", () => {
  it("lê o id da assinatura em cada tipo de evento relevante", () => {
    expect(subscriptionIdFromEvent(event("customer.subscription.updated", { id: "sub_a" }))).toBe("sub_a");
    expect(subscriptionIdFromEvent(event("checkout.session.completed", { mode: "subscription", subscription: "sub_b" }))).toBe("sub_b");
    expect(subscriptionIdFromEvent(event("checkout.session.completed", { mode: "payment", subscription: null }))).toBeNull();
    expect(subscriptionIdFromEvent(event("invoice.payment_failed", { parent: { subscription_details: { subscription: "sub_c" } } }))).toBe("sub_c");
    expect(subscriptionIdFromEvent(event("charge.refunded", { id: "ch_1" }))).toBeNull();
  });
});

describe("processStripeEvent", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await rootClient.$disconnect();
  });

  it("ativa a empresa a partir do estado lido na Stripe, não do corpo do evento", async () => {
    const company = await setupCompany("ativa");
    const sub = subscription({}, company.id);
    // O corpo do evento diz "canceled", mas vale o que a Stripe devolve na leitura.
    const result = await processStripeEvent(reader(sub), event("customer.subscription.created", { id: "sub_1", status: "canceled" }), () => NOW);

    expect(result).toMatchObject({ outcome: "PROCESSED", companyId: company.id });
    expect(await rootClient.subscription.findUniqueOrThrow({ where: { companyId: company.id } })).toMatchObject({
      status: "ACTIVE",
      planCode: "ESSENTIAL",
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_1",
    });
  });

  it("falha de pagamento vira pendente com carência e depois o pagamento volta a ativar", async () => {
    const company = await setupCompany("falha");
    await processStripeEvent(reader(subscription({}, company.id)), event("customer.subscription.created", { id: "sub_1" }), () => new Date("2026-10-03T12:00:00Z"));

    const failed = await processStripeEvent(
      reader(subscription({ status: "past_due" }, company.id)),
      event("invoice.payment_failed", { parent: { subscription_details: { subscription: "sub_1" } } }),
      () => new Date("2026-10-04T12:00:00Z")
    );
    expect(failed.detail).toContain("PAYMENT_PENDING");
    expect(await rootClient.subscription.findUniqueOrThrow({ where: { companyId: company.id } })).toMatchObject({ status: "PAYMENT_PENDING" });

    await processStripeEvent(reader(subscription({}, company.id)), event("invoice.paid", { parent: { subscription_details: { subscription: "sub_1" } } }), () => new Date("2026-10-05T12:00:00Z"));
    expect(await rootClient.subscription.findUniqueOrThrow({ where: { companyId: company.id } })).toMatchObject({ status: "ACTIVE", graceEndsAt: null });
  });

  it("cancelamento agendado na Stripe vira CANCELLATION_SCHEDULED", async () => {
    const company = await setupCompany("cancela");
    await processStripeEvent(reader(subscription({ cancel_at_period_end: true }, company.id)), event("customer.subscription.updated", { id: "sub_1" }), () => NOW);
    const row = await rootClient.subscription.findUniqueOrThrow({ where: { companyId: company.id } });
    expect(row.status).toBe("CANCELLATION_SCHEDULED");
    expect(row.cancellationEffectiveAt?.toISOString()).toBe("2026-11-03T12:00:00.000Z");
  });

  it("ignora o que não é cobrança e assinaturas de outro produto, e falha quando a dica aponta empresa inexistente", async () => {
    expect((await processStripeEvent(reader(subscription()), event("charge.refunded", { id: "ch_1" }))).outcome).toBe("IGNORED");
    expect((await processStripeEvent(reader(subscription()), event("customer.subscription.created", { id: "sub_1" }))).outcome).toBe("IGNORED");
    expect((await processStripeEvent(reader(subscription({}, randomUUID())), event("customer.subscription.created", { id: "sub_1" }))).outcome).toBe("FAILED");
  });
});
