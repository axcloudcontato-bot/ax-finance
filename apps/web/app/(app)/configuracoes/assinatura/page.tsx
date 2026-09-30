import { redirect } from "next/navigation";
import Link from "next/link";
import { CalendarDays, CheckCircle2, CreditCard, Download, Mail, ShieldAlert } from "@/components/ui/animated-icons";
import { getCompanySubscription, resolvePlanDefinition } from "@ax-finance/domain";
import { requirePrimaryCompany } from "@/lib/company";
import { getCurrentUser } from "@/lib/session";
import { scheduleCancellationAction, undoCancellationAction } from "./actions";

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

export default async function SubscriptionPage(props:{ searchParams: Promise<{ erro?:string; cancelamento?:string; recurso?:string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await requirePrimaryCompany(user.id);
  const subscription = await getCompanySubscription(user.id, company.id).catch(() => null);
  if (!subscription) redirect("/dashboard");
  const query = await props.searchParams;
  const plan = resolvePlanDefinition(subscription.planCode);
  const blockedResource = query.recurso ? ({
    "conciliacao-bancaria": "Conciliação bancária",
    fechamento: "Fechamento de período",
    auditoria: "Auditoria",
    "dre-gerencial": "DRE gerencial",
  } as Record<string, string>)[query.recurso] : undefined;

  return (
    <main className="wide settings-page">
      <div className="page-header">
        <div>
          <h1>Assinatura</h1>
          <p className="subtitle">Situação da assinatura de {company.name}.</p>
        </div>
      </div>
      {blockedResource ? <div className="subscription-upgrade-notice"><ShieldAlert className="size-5" /><div><strong>{blockedResource} não faz parte do plano Gestão Pessoal.</strong><p>Se precisar desse recurso, compare as versões abaixo e solicite a alteração do plano pelo suporte.</p></div></div> : null}
      {query.cancelamento ? <p className="success-box">{query.cancelamento === "agendado" ? "Cancelamento agendado. Gere e confira a exportação final antes da data efetiva." : "Agendamento de cancelamento removido."}</p> : null}
      {query.erro ? <p className="error">{query.erro}</p> : null}
      <div className="settings-grid subscription-settings-grid">
        <section className="card subscription-summary-card">
          <span className="settings-icon"><CreditCard className="size-5" /></span>
          <p className="settings-eyebrow">Plano atual</p>
          <h2>{plan.name}</h2>
          <strong className="subscription-plan-price">R$ {(plan.monthlyPriceCents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}<small>/mês</small></strong>
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

      <section className="subscription-plan-comparison" aria-labelledby="planos-title">
        <div className="settings-panel-header"><span className="settings-icon"><CreditCard className="size-5" /></span><div><h2 id="planos-title">Versões disponíveis</h2><p>Escolha o nível de controle adequado para sua rotina.</p></div></div>
        <div className="subscription-plan-grid">
          <article className={`card subscription-plan-option ${plan.code === "PERSONAL" ? "is-current" : ""}`}>
            <span className="settings-eyebrow">Uso individual</span><h3>Gestão Pessoal</h3><strong>R$ 29,90 <small>/mês</small></strong>
            <ul><li>Entradas, saídas e transferências</li><li>Contas, categorias, pessoas e centros de custo</li><li>Dashboard, fluxo de caixa e contas em aberto</li><li>Sem fechamento, auditoria, DRE e conciliação bancária</li></ul>
            {plan.code === "PERSONAL" ? <span className="subscription-current-plan">Plano atual</span> : <Link className="button-link secondary" href="/configuracoes/suporte">Solicitar mudança</Link>}
          </article>
          <article className={`card subscription-plan-option ${plan.code === "ESSENTIAL" ? "is-current" : ""}`}>
            <span className="settings-eyebrow">Gestão completa</span><h3>Essencial</h3><strong>R$ 59,00 <small>/mês</small></strong>
            <ul><li>Todos os recursos da Gestão Pessoal</li><li>Importação e conciliação CSV/OFX</li><li>Fechamento e trilha de auditoria</li><li>DRE gerencial</li></ul>
            {plan.code === "ESSENTIAL" ? <span className="subscription-current-plan">Plano atual</span> : <Link className="button-link" href="/configuracoes/suporte">Solicitar upgrade</Link>}
          </article>
        </div>
      </section>

      <section className="card settings-callout subscription-notice">
        <span className="settings-icon teal"><Mail className="size-5" /></span>
        <div><h2>Comunicações da assinatura</h2><p>Avisos de trial, renovação, falha de pagamento, carência e cancelamento são enviados aos proprietários pela campainha e por e-mail.</p></div>
      </section>

      <div className="settings-grid subscription-actions-grid">
        <section className="card settings-panel">
          <div className="settings-panel-header"><span className="settings-icon teal"><Download className="size-5" /></span><div><h2>Exportação final</h2><p>Baixe uma cópia completa e legível dos registros da empresa.</p></div></div>
          <p>O arquivo JSON contém cadastros, títulos, baixas, transferências, conciliações, fechamentos, auditoria e metadados de anexos. Valores monetários são exportados em centavos.</p>
          <a className="button-link" href="/api/exports/company">Gerar exportação completa</a>
          <p className="settings-info-note">Arquivos físicos dos anexos não fazem parte do JSON e devem ser baixados separadamente.</p>
        </section>
        <section className="card settings-panel subscription-danger-panel">
          <div className="settings-panel-header"><span className="settings-icon pink"><ShieldAlert className="size-5" /></span><div><h2>Cancelamento</h2><p>O cancelamento não apaga o histórico financeiro.</p></div></div>
          {subscription.status === "CANCELLATION_SCHEDULED" ? <><p>Cancelamento agendado para <strong>{formatDate(subscription.cancellationEffectiveAt)}</strong>. Você pode desfazer enquanto essa data não tiver chegado.</p><form action={undoCancellationAction}><button type="submit" className="secondary">Manter minha assinatura</button></form></> : <details className="subscription-cancellation"><summary>Quero cancelar a assinatura</summary><p>Revise a exportação antes de confirmar. Digite <strong>CANCELAR</strong> para agendar o encerramento.</p><form action={scheduleCancellationAction}><label>Confirmação<input name="confirmation" required autoComplete="off" /></label><button type="submit" className="danger-button">Agendar cancelamento</button></form></details>}
          <Link href="/cancelamento">Ler política de cancelamento e exportação</Link>
        </section>
      </div>
    </main>
  );
}
