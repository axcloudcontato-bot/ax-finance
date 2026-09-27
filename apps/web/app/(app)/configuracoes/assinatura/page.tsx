import { redirect } from "next/navigation";
import { getCompanySubscription } from "@ax-finance/domain";
import { requirePrimaryCompany } from "@/lib/company";
import { getCurrentUser } from "@/lib/session";

const STATUS_LABEL: Record<string, string> = {
  TRIAL: "Período de avaliação",
  ACTIVE: "Ativa",
  PAYMENT_PENDING: "Pagamento pendente",
  GRACE_PERIOD: "Em carência",
  SUSPENDED: "Suspensa",
  CANCELLATION_SCHEDULED: "Cancelamento agendado",
  CANCELLED: "Cancelada",
};

function formatDate(value: Date | null | undefined) {
  return value?.toLocaleDateString("pt-BR", { timeZone: "UTC" }) || "—";
}

export default async function SubscriptionPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await requirePrimaryCompany(user.id);
  const subscription = await getCompanySubscription(user.id, company.id).catch(() => null);
  if (!subscription) redirect("/dashboard");

  return (
    <main className="narrow">
      <div className="page-header">
        <div>
          <h1>Assinatura</h1>
          <p className="subtitle">Situação da assinatura de {company.name}.</p>
        </div>
      </div>
      <div className="card">
        <dl className="details-list">
            <div><dt>Status</dt><dd>{STATUS_LABEL[subscription.status] ?? subscription.status}</dd></div>
            <div><dt>Plano</dt><dd>{subscription.planCode}</dd></div>
            <div><dt>Fim do trial</dt><dd>{formatDate(subscription.trialEndsAt)}</dd></div>
            <div><dt>Fim do ciclo atual</dt><dd>{formatDate(subscription.currentPeriodEnd)}</dd></div>
            <div><dt>Fim da carência</dt><dd>{formatDate(subscription.graceEndsAt)}</dd></div>
            <div><dt>Cancelamento efetivo</dt><dd>{formatDate(subscription.cancellationEffectiveAt)}</dd></div>
        </dl>
        <p className="muted">
          Avisos de trial, renovação, falha de pagamento, carência e cancelamento são enviados
          aos proprietários pela campainha e por e-mail.
        </p>
      </div>
    </main>
  );
}
