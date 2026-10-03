import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@ax-finance/db";
import { registerUser } from "../identity/register";
import { createCompany } from "../companies/create-company";
import { linkStripeCustomer, listReconcilableSubscriptions } from "../billing/billing";
import { describeBillingDrift, reconcileStripeSubscriptions, type StripeReconcileClient } from "../billing/reconcile";
import { mapStripeSubscription, snapshotFromStripe, type StripeSubscriptionLike } from "../billing/stripe-state";
import { rootClient, resetDatabase } from "./test-db";

const CATALOG = { PERSONAL: "price_personal", ESSENTIAL: "price_essential" } as const;
const NOW = new Date("2026-10-03T12:00:00Z");
const epoch = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);

function remoteSubscription(overrides: Partial<StripeSubscriptionLike> = {}, companyId?: string): StripeSubscriptionLike {
  return {
    id: "sub_1",
    customer: "cus_1",
    status: "active",
    cancel_at_period_end: false,
    cancel_at: null,
    trial_end: null,
    metadata: companyId ? { companyId } : {},
    items: { data: [{ current_period_end: epoch("2026-11-03T12:00:00Z"), price: { id: CATALOG.ESSENTIAL } }] },
    ...overrides,
  };
}

function fakeClient(options: {
  byId?: Record<string, StripeSubscriptionLike | Error>;
  byCustomer?: Record<string, StripeSubscriptionLike[]>;
}): StripeReconcileClient & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    subscriptions: {
      async retrieve(id) {
        calls.push(`retrieve:${id}`);
        const found = options.byId?.[id];
        if (found instanceof Error) throw found;
        if (!found) throw Object.assign(new Error("No such subscription"), { code: "resource_missing" });
        return found;
      },
      async list({ customer }) {
        calls.push(`list:${customer}`);
        return { data: options.byCustomer?.[customer] ?? [] };
      },
    },
  };
}

async function setupCompany(label: string) {
  const user = await registerUser({ email: `${label}.${randomUUID()}@teste.ax.finance`, name: `Dona ${label}`, password: "senha-forte-123" });
  const company = await createCompany(user.id, { name: `Empresa ${label}` });
  return { user, company };
}

/** Deixa a empresa vinculada e em ACTIVE, como depois de um webhook normal. */
async function linkActive(companyId: string, subscriptionId = "sub_1", customerId = "cus_1") {
  await rootClient.subscription.update({
    where: { companyId },
    data: {
      status: "ACTIVE",
      planCode: "ESSENTIAL",
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      currentPeriodEnd: new Date("2026-11-03T12:00:00Z"),
      billingEventAt: new Date("2026-10-03T10:00:00Z"),
    },
  });
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

describe("describeBillingDrift", () => {
  const local = {
    companyId: "c",
    stripeCustomerId: "cus_1",
    stripeSubscriptionId: "sub_1",
    status: "ACTIVE",
    planCode: "ESSENTIAL",
    currentPeriodEnd: new Date("2026-11-03T12:00:00Z"),
    cancellationEffectiveAt: null,
  };

  it("não vê diferença quando o estado local acompanha a Stripe", () => {
    const remote = mapStripeSubscription(snapshotFromStripe(remoteSubscription()), CATALOG, NOW);
    expect(describeBillingDrift(local, remote)).toEqual([]);
  });

  it("aponta status, plano, ciclo e cancelamento que divergem", () => {
    const remote = mapStripeSubscription(
      snapshotFromStripe(remoteSubscription({
        status: "active",
        cancel_at_period_end: true,
        items: { data: [{ current_period_end: epoch("2026-12-03T12:00:00Z"), price: { id: CATALOG.PERSONAL } }] },
      })),
      CATALOG,
      NOW
    );
    const differences = describeBillingDrift(local, remote);
    expect(differences).toContain("status ACTIVE → CANCELLATION_SCHEDULED");
    expect(differences).toContain("plano ESSENTIAL → PERSONAL");
    expect(differences).toContain("fim do ciclo");
    expect(differences).toContain("cancelamento efetivo");
  });
});

describe("reconcileStripeSubscriptions", () => {
  it("corrige o status quando um webhook de falha de pagamento se perdeu", async () => {
    const { company } = await setupCompany("falha");
    await linkActive(company.id);
    const client = fakeClient({ byId: { sub_1: remoteSubscription({ status: "past_due" }, company.id) } });

    const summary = await reconcileStripeSubscriptions(client, CATALOG, { now: () => NOW });

    expect(summary).toEqual({ checked: 1, inSync: 0, corrected: 1, missingInProvider: 0, failed: 0 });
    expect(await readSubscription(company.id)).toMatchObject({ status: "PAYMENT_PENDING" });
    const events = await rootClient.$queryRaw<{ type: string; outcome: string; detail: string }[]>`
      SELECT type, outcome, detail FROM billing_events WHERE type = 'reconciliation.drift'
    `;
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ outcome: "PROCESSED" });
    expect(events[0]!.detail).toContain("status ACTIVE → PAYMENT_PENDING");
  });

  it("vincula a assinatura quando o webhook do primeiro pagamento nunca chegou", async () => {
    const { user, company } = await setupCompany("primeiro");
    await linkStripeCustomer(user.id, company.id, "cus_1"); // checkout aberto, sem webhook
    const client = fakeClient({
      byCustomer: {
        cus_1: [
          remoteSubscription({ id: "sub_outra" }, randomUUID()), // de outra empresa: ignorada
          remoteSubscription({ id: "sub_certa" }, company.id),
        ],
      },
    });

    const summary = await reconcileStripeSubscriptions(client, CATALOG, { now: () => NOW });

    expect(summary.corrected).toBe(1);
    expect(client.calls).toEqual(["list:cus_1"]);
    expect(await readSubscription(company.id)).toMatchObject({
      status: "ACTIVE",
      planCode: "ESSENTIAL",
      stripeSubscriptionId: "sub_certa",
    });
  });

  it("não grava nada quando já está em dia", async () => {
    const { company } = await setupCompany("emdia");
    await linkActive(company.id);
    const before = await readSubscription(company.id);

    const summary = await reconcileStripeSubscriptions(
      fakeClient({ byId: { sub_1: remoteSubscription({}, company.id) } }),
      CATALOG,
      { now: () => NOW }
    );

    expect(summary).toEqual({ checked: 1, inSync: 1, corrected: 0, missingInProvider: 0, failed: 0 });
    expect((await readSubscription(company.id)).billingEventAt?.toISOString()).toBe(before.billingEventAt?.toISOString());
    expect(await rootClient.billingEvent.count()).toBe(0);
  });

  it("ignora assinaturas canceladas e clientes sem checkout recente", async () => {
    const { company: cancelled } = await setupCompany("cancelada");
    await linkActive(cancelled.id, "sub_c", "cus_c");
    await rootClient.subscription.update({ where: { companyId: cancelled.id }, data: { status: "CANCELLED" } });

    const { user, company: stale } = await setupCompany("antiga");
    await linkStripeCustomer(user.id, stale.id, "cus_stale");
    await rootClient.$executeRaw`UPDATE subscriptions SET updated_at = now() - interval '10 days' WHERE company_id = ${stale.id}`;

    const { company: noStripe } = await setupCompany("semstripe");

    const listed = (await listReconcilableSubscriptions()).map((row) => row.companyId);
    expect(listed).not.toContain(cancelled.id);
    expect(listed).not.toContain(stale.id);
    expect(listed).not.toContain(noStripe.id);
  });

  it("assinatura que sumiu na Stripe é contada e não altera o estado local", async () => {
    const { company } = await setupCompany("sumiu");
    await linkActive(company.id);

    const summary = await reconcileStripeSubscriptions(fakeClient({ byId: {} }), CATALOG, { now: () => NOW });

    expect(summary).toEqual({ checked: 1, inSync: 0, corrected: 0, missingInProvider: 1, failed: 0 });
    expect(await readSubscription(company.id)).toMatchObject({ status: "ACTIVE" });
  });

  it("uma falha de rede não impede as demais empresas e fica registrada", async () => {
    const { company: broken } = await setupCompany("quebrada");
    await linkActive(broken.id, "sub_ruim", "cus_ruim");
    const { company: fine } = await setupCompany("boa");
    await linkActive(fine.id, "sub_boa", "cus_boa");
    await rootClient.subscription.update({ where: { companyId: fine.id }, data: { billingEventAt: new Date("2026-10-03T11:00:00Z") } });

    const client = fakeClient({
      byId: {
        sub_ruim: new Error("socket hang up"),
        sub_boa: remoteSubscription({ id: "sub_boa", customer: "cus_boa", status: "unpaid" }, fine.id),
      },
    });
    const summary = await reconcileStripeSubscriptions(client, CATALOG, { now: () => NOW });

    expect(summary).toMatchObject({ checked: 2, corrected: 1, failed: 1 });
    expect(await readSubscription(fine.id)).toMatchObject({ status: "SUSPENDED" });
    expect(await readSubscription(broken.id)).toMatchObject({ status: "ACTIVE" });
    const failures = await rootClient.$queryRaw<{ outcome: string; detail: string }[]>`
      SELECT outcome, detail FROM billing_events WHERE type = 'reconciliation.error'
    `;
    expect(failures).toEqual([{ outcome: "FAILED", detail: "socket hang up" }]);
  });

  it("não sobrescreve um estado que o webhook já gravou depois da leitura", async () => {
    const { company } = await setupCompany("corrida");
    await linkActive(company.id);
    await rootClient.subscription.update({ where: { companyId: company.id }, data: { billingEventAt: new Date("2026-10-03T12:00:30Z") } });

    // A conciliação leu o estado "past_due" às 12:00:00, mas o webhook gravou algo às 12:00:30.
    const summary = await reconcileStripeSubscriptions(
      fakeClient({ byId: { sub_1: remoteSubscription({ status: "past_due" }, company.id) } }),
      CATALOG,
      { now: () => NOW }
    );

    expect(summary.corrected).toBe(0);
    expect(await readSubscription(company.id)).toMatchObject({ status: "ACTIVE" });
  });
});
