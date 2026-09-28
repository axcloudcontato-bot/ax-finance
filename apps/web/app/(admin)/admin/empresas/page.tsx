import { redirect } from "next/navigation";
import { Building2, Search, SlidersHorizontal } from "lucide-react";
import { getPlatformAdminAccess, listAdminCompanies } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { loginPathFor } from "@/lib/auth-return";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { ActionModal } from "@/components/ui/action-modal";
import { updateSubscriptionAction } from "./actions";

const STATUS_LABEL: Record<string, string> = {
  TRIAL: "Trial",
  ACTIVE: "Ativa",
  PAYMENT_PENDING: "Pagamento pendente",
  GRACE_PERIOD: "Carência",
  SUSPENDED: "Suspensa",
  CANCELLATION_SCHEDULED: "Cancelamento agendado",
  CANCELLED: "Cancelada",
};

const STATUS_TONE: Record<string, string> = {
  ACTIVE: "success",
  TRIAL: "info",
  PAYMENT_PENDING: "warning",
  GRACE_PERIOD: "warning",
  SUSPENDED: "danger",
  CANCELLATION_SCHEDULED: "danger",
  CANCELLED: "neutral",
};

const dateValue = (value: Date | null | undefined) => value ? value.toISOString().slice(0, 10) : "";

export default async function AdminCompaniesPage({ searchParams }: { searchParams: { busca?: string; assinatura?: string; erro?: string; atualizada?: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect(loginPathFor("/admin/empresas"));
  const access = await getPlatformAdminAccess(user.id);
  if (!access) redirect("/dashboard");
  const subscriptionStatus = searchParams.assinatura && searchParams.assinatura !== "ALL" ? searchParams.assinatura : undefined;
  const companies = await listAdminCompanies(user.id, { search: searchParams.busca || undefined, subscriptionStatus });

  return (
    <main className="admin-content">
      <AdminPageHeader eyebrow="Base de clientes" title="Empresas e assinaturas" description="Consulte contas, acompanhe o ciclo de receita e intervenha em assinaturas com rastreabilidade." />
      {searchParams.erro ? <div className="admin-alert is-error">{searchParams.erro}</div> : null}
      {searchParams.atualizada ? <div className="admin-alert is-success">Assinatura atualizada. A intervenção foi registrada na auditoria.</div> : null}

      <form method="get" className="admin-filter-panel">
        <div className="admin-filter-heading"><span><SlidersHorizontal size={18} /></span><div><strong>Filtros</strong><small>Refine a lista por empresa ou situação comercial</small></div></div>
        <div className="admin-filter-fields">
          <div className="admin-search-field"><Search size={18} /><input id="admin-search" name="busca" aria-label="Empresa ou documento" placeholder="Buscar empresa ou documento..." defaultValue={searchParams.busca ?? ""} /></div>
          <select id="admin-subscription" name="assinatura" aria-label="Status da assinatura" defaultValue={searchParams.assinatura ?? "ALL"}>
            <option value="ALL">Todas as assinaturas</option>
            {Object.entries(STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <button type="submit">Aplicar filtros</button>
        </div>
      </form>

      <section className="admin-panel">
        <div className="admin-panel-heading compact">
          <div><span className="admin-panel-kicker">Diretório</span><h2>Empresas cadastradas</h2><p>Resultados ordenados pelas empresas mais recentes.</p></div>
          <span className="admin-count-badge">{companies.length} {companies.length === 1 ? "resultado" : "resultados"}</span>
        </div>
        {companies.length === 0 ? (
          <div className="admin-empty-state"><span><Building2 size={24} /></span><h3>Nenhuma empresa encontrada</h3><p>Tente remover os filtros ou buscar por outro termo.</p></div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table admin-company-table">
              <thead><tr><th>Empresa</th><th>Proprietário</th><th>Assinatura</th><th>Vigência</th><th>Uso da conta</th><th>Suporte</th><th>Ações</th></tr></thead>
              <tbody>{companies.map((company) => (
                <tr key={company.id}>
                  <td><div className="admin-company-cell"><span className="admin-company-icon"><Building2 size={18} /></span><div><strong>{company.name}</strong><small>{company.document || "Documento não informado"} · {company.status}</small></div></div></td>
                  <td>{company.owner ? <div className="admin-stacked-cell"><strong>{company.owner.name}</strong><small>{company.owner.email}</small></div> : <span className="admin-muted">Sem proprietário</span>}</td>
                  <td>{company.subscription ? <div className="admin-stacked-cell"><span className={`admin-badge is-${STATUS_TONE[company.subscription.status] ?? "neutral"}`}>{STATUS_LABEL[company.subscription.status] ?? company.subscription.status}</span><small>Plano {company.subscription.planCode}</small></div> : <span className="admin-badge is-neutral">Sem assinatura</span>}</td>
                  <td><span className="admin-table-secondary">{company.subscription?.trialEndsAt ? <>Trial até<br/><strong>{company.subscription.trialEndsAt.toLocaleDateString("pt-BR")}</strong></> : company.subscription?.currentPeriodEnd ? <>Período até<br/><strong>{company.subscription.currentPeriodEnd.toLocaleDateString("pt-BR")}</strong></> : "—"}</span></td>
                  <td><div className="admin-usage"><strong>{company._count.titles}</strong><span>títulos</span><small>{company._count.memberships} usuários · {company._count.financialAccounts} contas</small></div></td>
                  <td><span className={`admin-badge ${company._count.supportCases ? "is-warning" : "is-neutral"}`}>{company._count.supportCases} chamado(s)</span></td>
                  <td>{access.role === "SUPER_ADMIN" && company.subscription ? (
                    <ActionModal triggerLabel="Gerenciar" title={`Assinatura — ${company.name}`}>
                      <form action={updateSubscriptionAction.bind(null, company.id)}>
                        <label>Status</label><select name="status" defaultValue={company.subscription.status}>{Object.entries(STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
                        <label>Plano</label><input name="planCode" defaultValue={company.subscription.planCode} required maxLength={50} />
                        <label>Fim do trial</label><input name="trialEndsAt" type="date" defaultValue={dateValue(company.subscription.trialEndsAt)} />
                        <label>Fim do período</label><input name="currentPeriodEnd" type="date" defaultValue={dateValue(company.subscription.currentPeriodEnd)} />
                        <label>Fim da carência</label><input name="graceEndsAt" type="date" defaultValue={dateValue(company.subscription.graceEndsAt)} />
                        <label>Cancelamento efetivo</label><input name="cancellationEffectiveAt" type="date" defaultValue={dateValue(company.subscription.cancellationEffectiveAt)} />
                        <label>Motivo da intervenção</label><input name="reason" required maxLength={500} />
                        <button type="submit">Salvar assinatura</button>
                      </form>
                    </ActionModal>
                  ) : null}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
