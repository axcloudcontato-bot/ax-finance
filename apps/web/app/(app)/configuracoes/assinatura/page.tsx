import { redirect } from "next/navigation";
import { CalendarDays, CheckCircle2, CreditCard, Mail } from "@/components/ui/animated-icons";
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
    <main className="wide settings-page">
      <div className="page-header">
        <div>
          <h1>Assinatura</h1>
          <p className="subtitle">Situação da assinatura de {company.name}.</p>
        </div>
      </div>
      <div className="settings-grid subscription-settings-grid">
        <section className="card subscription-summary-card">
          <span className="settings-icon"><CreditCard className="size-5" /></span>
          <p className="settings-eyebrow">Plano atual</p>
          <h2>{subscription.planCode}</h2>
          <span className="subscription-status"><CheckCircle2 className="size-4" />{STATUS_LABEL[subscription.status] ?? subscription.status}</span>
          <p>Assinatura vinculada à empresa <strong>{company.name}</strong>.</p>
        </section>

        <section className="card settings-panel subscription-cycle-card">
          <div className="settings-panel-header">
            <span className="settings-icon orange"><CalendarDays className="size-5" /></span>
            <div><h2>Ciclo e datas</h2><p>Marcos atuais da sua assinatura.</p></div>
          </div>
          <dl className="subscription-date-grid">
            <div><dt>Fim do trial</dt><dd>{formatDate(subscription.trialEndsAt)}</dd></div>
            <div><dt>Fim do ciclo atual</dt><dd>{formatDate(subscription.currentPeriodEnd)}</dd></div>
            <div><dt>Fim da carência</dt><dd>{formatDate(subscription.graceEndsAt)}</dd></div>
            <div><dt>Cancelamento efetivo</dt><dd>{formatDate(subscription.cancellationEffectiveAt)}</dd></div>
          </dl>
        </section>
      </div>

      <section className="card settings-callout subscription-notice">
        <span className="settings-icon teal"><Mail className="size-5" /></span>
        <div><h2>Comunicações da assinatura</h2><p>Avisos de trial, renovação, falha de pagamento, carência e cancelamento são enviados aos proprietários pela campainha e por e-mail.</p></div>
      </section>
    </main>
  );
}
