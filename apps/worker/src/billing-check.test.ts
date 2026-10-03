import { describe, expect, it } from "vitest";
import { checkBillingConfiguration, stripeKeyMode, type PriceReader } from "./billing-check";

type Price = Awaited<ReturnType<PriceReader["prices"]["retrieve"]>>;

const GOOD: Record<string, Price> = {
  price_p: { id: "price_p", active: true, currency: "brl", unit_amount: 2990, recurring: { interval: "month", interval_count: 1 }, livemode: true },
  price_e: { id: "price_e", active: true, currency: "brl", unit_amount: 5900, recurring: { interval: "month", interval_count: 1 }, livemode: true },
};

function reader(prices: Record<string, Price | Error>): PriceReader {
  return {
    prices: {
      async retrieve(id) {
        const found = prices[id];
        if (found instanceof Error) throw found;
        if (!found) throw Object.assign(new Error("No such price"), { code: "resource_missing" });
        return found;
      },
    },
  };
}

const LIVE_ENV = {
  STRIPE_SECRET_KEY: "sk_live_x",
  STRIPE_PRICE_PERSONAL: "price_p",
  STRIPE_PRICE_ESSENTIAL: "price_e",
  APP_BASE_URL: "https://app.exemplo.com.br",
  NODE_ENV: "production",
};

describe("verificação da cobrança", () => {
  it("reconhece o modo pelo prefixo da chave sem expô-la", () => {
    expect(stripeKeyMode("sk_live_abc")).toBe("live");
    expect(stripeKeyMode("rk_live_abc")).toBe("live");
    expect(stripeKeyMode("sk_test_abc")).toBe("test");
    expect(stripeKeyMode("rk_test_abc")).toBe("test");
    expect(stripeKeyMode("abc")).toBe("unknown");
    expect(stripeKeyMode(undefined)).toBe("unknown");
  });

  it("aprova a configuração de produção correta", async () => {
    const result = await checkBillingConfiguration(reader(GOOD), LIVE_ENV);
    expect(result).toMatchObject({ mode: "live", ok: true, problems: [] });
    expect(result.prices.ESSENTIAL).toMatchObject({ amountCents: 5900, currency: "brl", interval: "1/month", active: true });
    expect(JSON.stringify(result)).not.toContain("sk_live");
  });

  it("recusa chave de teste em produção", async () => {
    const result = await checkBillingConfiguration(
      reader({ price_p: { ...GOOD.price_p!, livemode: false }, price_e: { ...GOOD.price_e!, livemode: false } }),
      { ...LIVE_ENV, STRIPE_SECRET_KEY: "sk_test_x" }
    );
    expect(result.ok).toBe(false);
    expect(result.problems[0]).toContain("Chave de TESTE em ambiente de produção");
  });

  it("pega preços trocados, valor errado, moeda, recorrência e preço arquivado", async () => {
    const result = await checkBillingConfiguration(
      reader({
        price_p: { ...GOOD.price_p!, unit_amount: 5900 }, // plano Pessoal com o valor do Essencial: ids trocados
        price_e: { ...GOOD.price_e!, currency: "usd", recurring: { interval: "year", interval_count: 1 }, active: false },
      }),
      LIVE_ENV
    );
    const text = result.problems.join(" | ");
    expect(result.ok).toBe(false);
    expect(text).toContain("PERSONAL: valor R$ 59.00, esperado R$ 29.90");
    expect(text).toContain("ESSENTIAL: moeda USD, esperado BRL");
    expect(text).toContain("ESSENTIAL: o preço price_e não é mensal");
    expect(text).toContain("ESSENTIAL: o preço price_e está arquivado");
  });

  it("explica quando o preço não existe naquele modo e quando a variável falta", async () => {
    const missing = await checkBillingConfiguration(reader({ price_e: GOOD.price_e! }), LIVE_ENV);
    expect(missing.problems.join(" ")).toContain("price_p não existe nesta conta/modo");

    const unset = await checkBillingConfiguration(reader(GOOD), { ...LIVE_ENV, STRIPE_PRICE_ESSENTIAL: undefined });
    expect(unset.problems).toContain("STRIPE_PRICE_ESSENTIAL não configurado.");

    const same = await checkBillingConfiguration(reader(GOOD), { ...LIVE_ENV, STRIPE_PRICE_ESSENTIAL: "price_p" });
    expect(same.problems.join(" ")).toContain("apontam para o mesmo preço");
  });

  it("avisa de APP_BASE_URL sem https com chave de produção e não derruba por erro de rede", async () => {
    const http = await checkBillingConfiguration(reader(GOOD), { ...LIVE_ENV, APP_BASE_URL: "http://app.exemplo.com.br" });
    expect(http.problems.join(" ")).toContain("APP_BASE_URL deveria ser https://");

    const network = await checkBillingConfiguration(reader({ price_p: new Error("socket hang up: detalhe"), price_e: GOOD.price_e! }), LIVE_ENV);
    expect(network.ok).toBe(false);
    expect(network.problems.join(" ")).toContain("não foi possível ler o preço price_p (socket hang up)");
  });
});
