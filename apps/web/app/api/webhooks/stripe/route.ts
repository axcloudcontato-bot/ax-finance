import { NextResponse } from "next/server";
import Stripe from "stripe";
import { claimBillingEvent, finishBillingEvent } from "@ax-finance/domain";
import { getStripe, stripeWebhookSecret } from "@/lib/stripe";
import { processStripeEvent } from "@/lib/stripe-webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Webhook da Stripe. A assinatura é verificada sobre o corpo ORIGINAL (por isso
 * `request.text()`), com a tolerância padrão de 5 min contra replay. Responder 2xx só
 * depois de gravar o resultado; erro de processamento devolve 500 para a Stripe
 * reentregar, e reentregas de eventos já concluídos são ignoradas pelo claim.
 */
export async function POST(request: Request) {
  const secret = stripeWebhookSecret();
  if (!secret || !process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Webhook não configurado." }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Assinatura ausente." }, { status: 400 });

  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = Stripe.webhooks.constructEvent(body, signature, secret);
  } catch {
    return NextResponse.json({ error: "Assinatura inválida." }, { status: 400 });
  }

  try {
    if (!(await claimBillingEvent(event.id, event.type))) {
      return NextResponse.json({ received: true, duplicate: true });
    }
    const result = await processStripeEvent(getStripe(), event);
    await finishBillingEvent(event.id, result.outcome, { companyId: result.companyId, message: result.detail });
    // FAILED pede nova entrega da Stripe; PROCESSED e IGNORED encerram o evento.
    if (result.outcome === "FAILED") return NextResponse.json({ error: result.detail }, { status: 500 });
    return NextResponse.json({ received: true, outcome: result.outcome });
  } catch (error) {
    const message = error instanceof Error ? error.message : "erro desconhecido";
    await finishBillingEvent(event.id, "FAILED", { message }).catch(() => undefined);
    return NextResponse.json({ error: "Falha ao processar o evento." }, { status: 500 });
  }
}
