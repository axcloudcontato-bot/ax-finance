import { redirect } from "next/navigation";
import { AlertTriangle, Building2, CircleDollarSign, CircleHelp, Clock3, CreditCard, TrendingDown, TrendingUp } from "lucide-react";
import { getAdminBusinessMetrics, getPlatformAdminAccess } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { loginPathFor } from "@/lib/auth-return";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminStatCard } from "@/components/admin/admin-stat-card";

const percent = (value: number) => new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 }).format(value);
const monthLabel = (value: string) => new Date(`${value}-01T00:00:00Z`).toLocaleDateString("pt-BR", { month: "short", year: "2-digit", timeZone: "UTC" });

export default async function AdminDashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect(loginPathFor("/admin"));
  const access = await getPlatformAdminAccess(user.id);
  if (!access) redirect("/dashboard");
  const metrics = await getAdminBusinessMetrics(user.id);

  return (
    <main className="admin-content">
      <AdminPageHeader eyebrow="Visão geral" title={`Olá, ${user.name.split(" ")[0]}`} description="Acompanhe crescimento, receita e pontos de atenção da plataforma em um só lugar." actions={<span className="admin-role-pill">{access.role.replace("_", " ")}</span>} />
      <section className="admin-stat-grid" aria-label="Indicadores principais">
        <AdminStatCard label="Empresas" value={metrics.totalCompanies} detail={`${metrics.newCompanies30d} novas nos últimos 30 dias`} icon={<Building2 size={20} />} tone="blue" />
        <AdminStatCard label="Taxa de ativação" value={percent(metrics.activationRate)} detail={`${metrics.activatedCompanies} empresas com lançamento`} icon={<TrendingUp size={20} />} tone="green" />
        <AdminStatCard label="Conversão" value={percent(metrics.conversionRate)} detail={`${metrics.paidCompanies} assinaturas convertidas`} icon={<CircleDollarSign size={20} />} tone="violet" />
        <AdminStatCard label="Cancelamento" value={percent(metrics.cancellationRate)} detail={`${metrics.cancelledCompanies} empresas canceladas`} icon={<TrendingDown size={20} />} tone="red" />
        <AdminStatCard label="Trials ativos" value={metrics.trialCompanies} detail={`${metrics.trialsExpiring7d} vencem em até 7 dias`} icon={<Clock3 size={20} />} tone="orange" />
        <AdminStatCard label="Inadimplência" value={metrics.delinquentCompanies} detail="Pendentes, em carência ou suspensas" icon={<CreditCard size={20} />} tone="red" />
        <AdminStatCard label="Suporte aberto" value={metrics.openSupportCases} detail="Chamados em acompanhamento" icon={<CircleHelp size={20} />} tone="blue" />
        <AdminStatCard label="Incidentes ativos" value={metrics.activeIncidents} detail="Investigação ou monitoramento" icon={<AlertTriangle size={20} />} tone="orange" />
      </section>
      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div><span className="admin-panel-kicker">Crescimento</span><h2>Coortes dos últimos seis meses</h2><p>Ativação exige ao menos um título lançado; conversão considera o estado atual da assinatura.</p></div>
          <span className="admin-panel-chip">6 meses</span>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Mês</th><th>Empresas</th><th>Ativadas</th><th>Convertidas</th><th>Ativação</th><th>Conversão</th></tr></thead>
            <tbody>{metrics.cohorts.map((item) => {
              const activation = item.companies ? item.activated / item.companies : 0;
              const conversion = item.companies ? item.converted / item.companies : 0;
              return <tr key={item.month}><td><strong className="admin-table-primary">{monthLabel(item.month)}</strong></td><td>{item.companies}</td><td>{item.activated}</td><td>{item.converted}</td><td><div className="admin-progress-cell"><span>{percent(activation)}</span><i><b style={{ width: `${activation * 100}%` }} /></i></div></td><td><div className="admin-progress-cell violet"><span>{percent(conversion)}</span><i><b style={{ width: `${conversion * 100}%` }} /></i></div></td></tr>;
            })}</tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
