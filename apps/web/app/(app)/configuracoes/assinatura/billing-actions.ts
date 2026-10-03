"use server";

import { redirect } from "next/navigation";
import { getCompanySubscription, linkStripeCustomer, type SelectablePlanCode } from "@ax-finance/domain";
import { requirePrimaryCompany } from "@/lib/company";
import { getCurrentUser } from "@/lib/session";
import { getStripe, priceCatalog, stripeConfigured, userFacingBillingError } from "@/lib/stripe";

const PAGE = "/configuracoes/assinatura";
// A Stripe exige trial_end com pelo menos 48 h de antecedência.
const MIN_TRIAL_LEAD_MS = 49 * 60 * 60 * 1000;

function fail(message: string): never {
  redirect(`${PAGE}?erro=${encodeURIComponent(message)}`);
}

function baseUrl() {
  return (process.env.APP_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
}

async function actor() {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?retorno=${encodeURIComponent(PAGE)}`);
  const company = await requirePrimaryCompany(user.id);
  return { user, company };
}

/**
 * Abre o Checkout hospedado da Stripe (cartão). Não ativa nada: o plano só muda quando
 * o webhook confirmar a assinatura no provedor (DIRECAO §21), e o trial local que
 * ainda restar vira o trial da assinatura, então a primeira cobrança só ocorre depois.
 */
export async function startCheckoutAction(planCode: SelectablePlanCode) {
  const { user, company } = await actor();
  if (!stripeConfigured()) fail("A cobrança por cartão ainda não está disponível neste ambiente.");
  const priceId = priceCatalog()[planCode];
  if (!priceId) fail("Plano indisponível para assinatura.");

  let url: string | null = null;
  try {
    const subscription = await getCompanySubscription(user.id, company.id);
    if (!subscription) throw new Error("Assinatura não encontrada.");
    if (subscription.stripeSubscriptionId && subscription.status !== "CANCELLED") {
      throw new Error("Esta empresa já tem uma assinatura paga. Use “Gerenciar cobrança” para trocar de plano.");
    }

    const stripe = getStripe();
    let customerId = subscription.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create(
        { email: user.email, name: company.name, metadata: { companyId: company.id } },
        { idempotencyKey: `ax-customer-${company.id}` }
      );
      customerId = customer.id;
      await linkStripeCustomer(user.id, company.id, customerId);
    }

    const trialEndsAt = subscription.status === "TRIAL" ? subscription.trialEndsAt : null;
    const keepTrial = trialEndsAt && trialEndsAt.getTime() - Date.now() >= MIN_TRIAL_LEAD_MS ? trialEndsAt : null;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      allowed_payment_method_types: ["card"], // só cartão (decisão do produto)
      client_reference_id: company.id,
      metadata: { companyId: company.id, planCode },
      subscription_data: {
        metadata: { companyId: company.id, planCode },
        ...(keepTrial ? { trial_end: Math.floor(keepTrial.getTime() / 1000) } : {}),
      },
      locale: "pt-BR",
      success_url: `${baseUrl()}${PAGE}?checkout=retorno`,
      cancel_url: `${baseUrl()}${PAGE}?checkout=cancelado`,
    });
    url = session.url;
  } catch (error) {
    fail(userFacingBillingError(error, "Não foi possível iniciar o pagamento. Tente novamente em instantes."));
  }
  if (!url) fail("A Stripe não devolveu o endereço de pagamento.");
  redirect(url);
}

/** Portal hospedado: cartão, faturas/recibos, troca de plano e cancelamento. */
export async function openBillingPortalAction() {
  const { user, company } = await actor();
  if (!stripeConfigured()) fail("A cobrança por cartão ainda não está disponível neste ambiente.");

  let url: string | null = null;
  try {
    const subscription = await getCompanySubscription(user.id, company.id);
    if (!subscription?.stripeCustomerId) throw new Error("Ainda não há cobrança cadastrada para esta empresa.");
    const session = await getStripe().billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${baseUrl()}${PAGE}`,
    });
    url = session.url;
  } catch (error) {
    fail(userFacingBillingError(error, "Não foi possível abrir o portal de cobrança. Tente novamente em instantes."));
  }
  if (!url) fail("A Stripe não devolveu o endereço do portal.");
  redirect(url);
}
