import Stripe from "stripe";
import { PLAN_CATALOG, priceCatalogFromEnv, type SelectablePlanCode } from "@ax-finance/domain";

/** Só o que a verificação usa da SDK, para testar sem rede. */
export interface PriceReader {
  prices: {
    retrieve(id: string): Promise<{
      id: string;
      active: boolean;
      currency: string;
      unit_amount: number | null;
      recurring: { interval: string; interval_count: number } | null;
      livemode?: boolean;
    }>;
  };
}

export interface BillingCheckResult {
  mode: "live" | "test" | "unknown";
  ok: boolean;
  problems: string[];
  prices: Partial<Record<SelectablePlanCode, { id: string; amountCents: number | null; currency: string; interval: string | null; active: boolean }>>;
}

export function stripeKeyMode(key: string | undefined): BillingCheckResult["mode"] {
  if (!key) return "unknown";
  if (/^(sk|rk)_live_/.test(key)) return "live";
  if (/^(sk|rk)_test_/.test(key)) return "test";
  return "unknown";
}

/**
 * Confere a configuração de cobrança sem cobrar nada: modo da chave, e para cada plano se o
 * preço existe, está ativo, é mensal, em BRL e tem o valor do catálogo. Pega os erros caros
 * antes de um cliente real: chave de teste em produção, ids de preço trocados, valor errado.
 * Não imprime nem devolve a chave.
 */
export async function checkBillingConfiguration(
  reader: PriceReader,
  env: Record<string, string | undefined> = process.env
): Promise<BillingCheckResult> {
  const catalog = priceCatalogFromEnv(env);
  const mode = stripeKeyMode(env.STRIPE_SECRET_KEY);
  const problems: string[] = [];
  const prices: BillingCheckResult["prices"] = {};

  if (mode === "unknown") problems.push("STRIPE_SECRET_KEY ausente ou em formato desconhecido.");
  if (mode === "test" && env.NODE_ENV === "production") {
    problems.push("Chave de TESTE em ambiente de produção: nenhuma cobrança é real e qualquer um conclui o pagamento com o cartão 4242.");
  }
  if (mode === "live" && env.APP_BASE_URL && !env.APP_BASE_URL.startsWith("https://")) {
    problems.push("APP_BASE_URL deveria ser https:// com chave de produção (as URLs de retorno do checkout saem dela).");
  }
  if (catalog.PERSONAL && catalog.PERSONAL === catalog.ESSENTIAL) {
    problems.push("STRIPE_PRICE_PERSONAL e STRIPE_PRICE_ESSENTIAL apontam para o mesmo preço.");
  }

  for (const plan of ["PERSONAL", "ESSENTIAL"] as const) {
    const id = catalog[plan];
    if (!id) {
      problems.push(`STRIPE_PRICE_${plan} não configurado.`);
      continue;
    }
    try {
      const price = await reader.prices.retrieve(id);
      prices[plan] = {
        id: price.id,
        amountCents: price.unit_amount,
        currency: price.currency,
        interval: price.recurring ? `${price.recurring.interval_count}/${price.recurring.interval}` : null,
        active: price.active,
      };
      if (!price.active) problems.push(`${plan}: o preço ${id} está arquivado.`);
      if (price.currency !== "brl") problems.push(`${plan}: moeda ${price.currency.toUpperCase()}, esperado BRL.`);
      if (!price.recurring || price.recurring.interval !== "month" || price.recurring.interval_count !== 1) {
        problems.push(`${plan}: o preço ${id} não é mensal.`);
      }
      const expected = PLAN_CATALOG[plan].monthlyPriceCents;
      if (price.unit_amount !== expected) {
        problems.push(`${plan}: valor ${price.unit_amount === null ? "indefinido" : `R$ ${(price.unit_amount / 100).toFixed(2)}`}, esperado R$ ${(expected / 100).toFixed(2)}.`);
      }
      if (mode === "live" && price.livemode === false) problems.push(`${plan}: o preço ${id} é de teste, mas a chave é de produção.`);
      if (mode === "test" && price.livemode === true) problems.push(`${plan}: o preço ${id} é de produção, mas a chave é de teste.`);
    } catch (error) {
      const code = (error as { code?: string }).code;
      problems.push(
        code === "resource_missing"
          ? `${plan}: o preço ${id} não existe nesta conta/modo (ids de teste não valem em produção, e vice-versa).`
          : `${plan}: não foi possível ler o preço ${id} (${error instanceof Error ? error.message.split(":")[0] : "erro"}).`
      );
    }
  }

  return { mode, ok: problems.length === 0, problems, prices };
}

export async function runBillingCheck(env: Record<string, string | undefined> = process.env) {
  if (!env.STRIPE_SECRET_KEY) {
    return checkBillingConfiguration({ prices: { retrieve: async () => { throw new Error("sem chave"); } } }, env);
  }
  return checkBillingConfiguration(new Stripe(env.STRIPE_SECRET_KEY, { appInfo: { name: "AX Finance worker" } }) as unknown as PriceReader, env);
}
