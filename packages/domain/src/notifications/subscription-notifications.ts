import { withCompanyContext } from "@ax-finance/db";
import { assertActiveMembership } from "../companies/assert-membership";
import { enqueueBillingNoticeEmail } from "../outbox/events";

const DAY_MS = 24 * 60 * 60 * 1000;

type BillingNoticeType =
  | "BILLING_TRIAL_ENDING"
  | "BILLING_TRIAL_ENDED"
  | "BILLING_PAYMENT_DUE"
  | "BILLING_PAYMENT_FAILED"
  | "BILLING_GRACE_PERIOD"
  | "BILLING_CANCELLATION_SCHEDULED"
  | "BILLING_CANCELLED";

interface BillingNotice {
  type: BillingNoticeType;
  key: string;
  title: string;
  body: string;
  href: string;
}

function dateKey(value: Date | null) {
  return value?.toISOString().slice(0, 10) || "sem-data";
}

function formatDate(value: Date | null) {
  return value
    ? value.toLocaleDateString("pt-BR", { timeZone: "UTC" })
    : "data ainda não informada";
}

function remainingDays(value: Date, now: Date) {
  return Math.ceil((value.getTime() - now.getTime()) / DAY_MS);
}

function resolveNotice(subscription: {
  id: string;
  status: string;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  graceEndsAt: Date | null;
  cancellationEffectiveAt: Date | null;
}, now: Date): BillingNotice | null {
  if (subscription.status === "TRIAL" && subscription.trialEndsAt) {
    const days = remainingDays(subscription.trialEndsAt, now);
    if (days <= 0) return {
      type: "BILLING_TRIAL_ENDED",
      key: `trial-ended:${dateKey(subscription.trialEndsAt)}`,
      title: "Trial encerrado",
      body: "O período de avaliação terminou. Escolha um plano para manter todos os recursos disponíveis.",
      href: "/configuracoes/assinatura",
    };
    const milestone = days <= 1 ? 1 : days <= 3 ? 3 : days <= 7 ? 7 : null;
    if (milestone) return {
      type: "BILLING_TRIAL_ENDING",
      key: `trial-ending:${dateKey(subscription.trialEndsAt)}:${milestone}`,
      title: "Trial próximo do fim",
      body: `Seu período de avaliação termina em ${days} dia(s), em ${formatDate(subscription.trialEndsAt)}.`,
      href: "/configuracoes/assinatura",
    };
  }

  if (subscription.status === "ACTIVE" && subscription.currentPeriodEnd) {
    const days = remainingDays(subscription.currentPeriodEnd, now);
    if (days >= 0 && days <= 3) return {
      type: "BILLING_PAYMENT_DUE",
      key: `renewal-due:${dateKey(subscription.currentPeriodEnd)}`,
      title: "Renovação próxima",
      body: `A renovação da assinatura está prevista para ${formatDate(subscription.currentPeriodEnd)}.`,
      href: "/configuracoes/assinatura",
    };
  }

  if (subscription.status === "PAYMENT_PENDING") return {
    type: "BILLING_PAYMENT_DUE",
    key: `payment-pending:${dateKey(subscription.currentPeriodEnd)}`,
    title: "Pagamento pendente",
    body: "Existe uma cobrança pendente para a assinatura. Verifique os dados de pagamento.",
    href: "/configuracoes/assinatura",
  };

  if (subscription.status === "GRACE_PERIOD") return {
    type: "BILLING_GRACE_PERIOD",
    key: `grace-period:${dateKey(subscription.graceEndsAt)}`,
    title: "Assinatura em período de carência",
    body: `O pagamento continua pendente. O período de carência termina em ${formatDate(subscription.graceEndsAt)}.`,
    href: "/configuracoes/assinatura",
  };

  if (subscription.status === "SUSPENDED") return {
    type: "BILLING_PAYMENT_FAILED",
    key: `payment-failed:${dateKey(subscription.graceEndsAt)}`,
    title: "Assinatura suspensa por inadimplência",
    body: "A escrita foi suspensa após falhas de pagamento. Regularize a assinatura para restaurar o acesso completo.",
    href: "/configuracoes/assinatura",
  };

  if (subscription.status === "CANCELLATION_SCHEDULED") return {
    type: "BILLING_CANCELLATION_SCHEDULED",
    key: `cancellation-scheduled:${dateKey(subscription.cancellationEffectiveAt)}`,
    title: "Cancelamento agendado",
    body: `A assinatura está programada para encerrar em ${formatDate(subscription.cancellationEffectiveAt)}.`,
    href: "/configuracoes/assinatura",
  };

  if (subscription.status === "CANCELLED") return {
    type: "BILLING_CANCELLED",
    key: `cancelled:${dateKey(subscription.cancellationEffectiveAt)}`,
    title: "Assinatura cancelada",
    body: "A assinatura foi encerrada. Seus registros continuam sujeitos à política de retenção e exportação.",
    href: "/configuracoes/assinatura",
  };

  return null;
}

export async function generateSubscriptionNotifications(
  userId: string,
  companyId: string,
  now = new Date()
) {
  await assertActiveMembership(userId, companyId);
  return withCompanyContext(userId, companyId, async (tx) => {
    const [company, subscription, owners] = await Promise.all([
      tx.company.findUniqueOrThrow({ where: { id: companyId } }),
      tx.subscription.findUnique({ where: { companyId } }),
      tx.membership.findMany({
        where: { companyId, status: "ACTIVE", role: "OWNER" },
        include: { user: true },
      }),
    ]);
    if (!subscription || owners.length === 0) return { notificationsCreated: 0, emailsQueued: 0 };
    const notice = resolveNotice(subscription, now);
    if (!notice) return { notificationsCreated: 0, emailsQueued: 0 };

    const notificationRows = owners.map((owner) => ({
      companyId,
      userId: owner.userId,
      type: notice.type,
      dedupKey: `billing:${subscription.id}:${notice.key}:${owner.userId}`,
      title: notice.title,
      body: notice.body,
      href: notice.href,
    }));
    const created = await tx.notification.createMany({ data: notificationRows, skipDuplicates: true });
    let emailsQueued = 0;
    for (const owner of owners) {
      const queued = await enqueueBillingNoticeEmail(
        tx,
        `billing-email:${subscription.id}:${notice.key}:${owner.userId}`,
        {
          to: owner.user.email,
          name: owner.user.name,
          companyName: company.name,
          noticeType: notice.type,
          title: notice.title,
          body: notice.body,
          href: notice.href,
        }
      );
      emailsQueued += queued.count;
    }
    return { notificationsCreated: created.count, emailsQueued };
  });
}
