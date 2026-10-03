import { afterEach, describe, expect, it, vi } from "vitest";
import {
  billingReconciliationEnabled,
  billingReconciliationIntervalMs,
  maybeRunBillingReconciliation,
} from "./billing-reconciliation";

const CONFIGURED = {
  STRIPE_SECRET_KEY: "sk_test_x",
  STRIPE_PRICE_PERSONAL: "price_p",
  STRIPE_PRICE_ESSENTIAL: "price_e",
};

const SUMMARY = { checked: 1, inSync: 1, corrected: 0, missingInProvider: 0, failed: 0 };

afterEach(() => {
  vi.unstubAllEnvs();
});

function stubConfigured() {
  for (const [key, value] of Object.entries(CONFIGURED)) vi.stubEnv(key, value);
}

describe("conciliação da cobrança no worker", () => {
  it("só fica ligada com a chave e os dois preços", () => {
    expect(billingReconciliationEnabled({})).toBe(false);
    expect(billingReconciliationEnabled({ STRIPE_SECRET_KEY: "sk_test_x", STRIPE_PRICE_PERSONAL: "price_p" })).toBe(false);
    expect(billingReconciliationEnabled(CONFIGURED)).toBe(true);
  });

  it("intervalo padrão de 1 hora e mínimo de 1 minuto", () => {
    expect(billingReconciliationIntervalMs({})).toBe(3_600_000);
    expect(billingReconciliationIntervalMs({ BILLING_RECONCILE_INTERVAL_MS: "5" })).toBe(60_000);
    expect(billingReconciliationIntervalMs({ BILLING_RECONCILE_INTERVAL_MS: "120000" })).toBe(120_000);
  });

  it("não executa sem configuração", async () => {
    // O .env local pode ter chaves de teste; o cenário aqui é ambiente sem Stripe.
    for (const key of Object.keys(CONFIGURED)) vi.stubEnv(key, "");
    const run = vi.fn(async () => SUMMARY);
    expect(await maybeRunBillingReconciliation({ lastRun: 0 }, Date.now(), run)).toBeNull();
    expect(run).not.toHaveBeenCalled();
  });

  it("executa na partida, depois respeita o intervalo", async () => {
    stubConfigured();
    const run = vi.fn(async () => SUMMARY);
    const state = { lastRun: 0 };
    const start = 10_000_000;

    expect(await maybeRunBillingReconciliation(state, start, run)).toEqual(SUMMARY);
    expect(await maybeRunBillingReconciliation(state, start + 60_000, run)).toBeNull();
    expect(await maybeRunBillingReconciliation(state, start + 3_600_000, run)).toEqual(SUMMARY);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("nunca lança: falha vira log e a próxima tentativa só vem no intervalo", async () => {
    stubConfigured();
    const state = { lastRun: 0 };
    const run = vi.fn(async () => {
      throw new Error("stripe fora do ar");
    });

    await expect(maybeRunBillingReconciliation(state, 5_000_000, run)).resolves.toBeNull();
    expect(state.lastRun).toBe(5_000_000);
    await maybeRunBillingReconciliation(state, 5_000_001, run);
    expect(run).toHaveBeenCalledTimes(1);
  });
});
