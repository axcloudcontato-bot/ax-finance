import { withCompanyContext } from "@ax-finance/db";
import { SubscriptionWriteBlockedError } from "../errors";

export type WriteBlockReason = "SUSPENDED" | "ENDED" | "TRIAL_ENDED";

/**
 * Suspensa para escrita (DIRECAO §21): com a assinatura SUSPENDED ou encerrada a empresa
 * continua vendo e exportando os dados, mas não cria nem altera lançamentos. Pagamento
 * pendente e carência NÃO bloqueiam; só avisam.
 *
 * CANCELLATION_SCHEDULED vale como encerrada a partir da data efetiva, mesmo que nenhum
 * sinal do provedor tenha chegado (cobre o cancelamento de quem nunca assinou na Stripe).
 *
 * Trial vencido SEM assinatura na Stripe também bloqueia: nenhum sinal do provedor vai
 * mudar esse estado, porque a Stripe não conhece o cliente. Quem já assinou (trial da
 * própria Stripe, com cartão) fica de fora: a data não decide, o provedor decide, e o
 * webhook que vira ACTIVE pode levar alguns minutos depois do fim do trial.
 * Empresa sem registro de assinatura (legado) segue liberada.
 */
export function writeBlockReason(
  subscription: {
    status: string;
    cancellationEffectiveAt: Date | null;
    trialEndsAt?: Date | null;
    stripeSubscriptionId?: string | null;
  } | null,
  now = new Date()
): WriteBlockReason | null {
  if (!subscription) return null;
  if (subscription.status === "SUSPENDED") return "SUSPENDED";
  if (subscription.status === "CANCELLED") return "ENDED";
  if (
    subscription.status === "TRIAL" &&
    !subscription.stripeSubscriptionId &&
    subscription.trialEndsAt &&
    subscription.trialEndsAt <= now
  ) {
    return "TRIAL_ENDED";
  }
  if (
    subscription.status === "CANCELLATION_SCHEDULED" &&
    subscription.cancellationEffectiveAt &&
    subscription.cancellationEffectiveAt <= now
  ) {
    return "ENDED";
  }
  return null;
}

export async function getWriteBlockReason(userId: string, companyId: string, now = new Date()) {
  const subscription = await withCompanyContext(userId, companyId, (tx) =>
    tx.subscription.findUnique({
      where: { companyId },
      select: { status: true, cancellationEffectiveAt: true, trialEndsAt: true, stripeSubscriptionId: true },
    })
  );
  return writeBlockReason(subscription, now);
}

/** Lança SubscriptionWriteBlockedError quando a empresa está bloqueada para escrita. */
export async function assertSubscriptionAllowsWrites(userId: string, companyId: string, now = new Date()) {
  const reason = await getWriteBlockReason(userId, companyId, now);
  if (reason) throw new SubscriptionWriteBlockedError(reason);
}
