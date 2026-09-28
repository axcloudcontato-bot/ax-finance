import { redirect } from "next/navigation";
import { getAdminBusinessMetrics, getPlatformAdminAccess } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { AdminNav } from "@/components/admin/admin-nav";
import { loginPathFor } from "@/lib/auth-return";

const percent = (value:number) => new Intl.NumberFormat("pt-BR",{style:"percent",maximumFractionDigits:1}).format(value);
const monthLabel=(value:string)=>new Date(`${value}-01T00:00:00Z`).toLocaleDateString("pt-BR",{month:"short",year:"2-digit",timeZone:"UTC"});

export default async function AdminDashboardPage(){
  const user=await getCurrentUser();if(!user)redirect(loginPathFor("/admin"));
  const access=await getPlatformAdminAccess(user.id);if(!access)redirect("/dashboard");
  const metrics=await getAdminBusinessMetrics(user.id);
  return <main className="wide"><div className="page-header"><div><h1>Painel administrativo interno</h1><p className="subtitle">Visão consolidada da operação, crescimento e saúde da base. Papel: {access.role}.</p></div></div><AdminNav/>
    <div className="admin-kpi-grid">
      <div className="card"><span className="muted">Empresas</span><h1>{metrics.totalCompanies}</h1><p className="subtitle">{metrics.newCompanies30d} novas em 30 dias</p></div>
      <div className="card"><span className="muted">Ativação</span><h1>{percent(metrics.activationRate)}</h1><p className="subtitle">{metrics.activatedCompanies} empresas com lançamento</p></div>
      <div className="card"><span className="muted">Conversão</span><h1>{percent(metrics.conversionRate)}</h1><p className="subtitle">{metrics.paidCompanies} assinaturas convertidas</p></div>
      <div className="card"><span className="muted">Cancelamento</span><h1>{percent(metrics.cancellationRate)}</h1><p className="subtitle">{metrics.cancelledCompanies} canceladas</p></div>
      <div className="card"><span className="muted">Trials</span><h1>{metrics.trialCompanies}</h1><p className="subtitle">{metrics.trialsExpiring7d} vencem em até 7 dias</p></div>
      <div className="card"><span className="muted">Inadimplência</span><h1>{metrics.delinquentCompanies}</h1><p className="subtitle">Pendentes, carência ou suspensas</p></div>
      <div className="card"><span className="muted">Suporte aberto</span><h1>{metrics.openSupportCases}</h1><p className="subtitle">Chamados em acompanhamento</p></div>
      <div className="card"><span className="muted">Incidentes ativos</span><h1>{metrics.activeIncidents}</h1><p className="subtitle">Investigação, identificação ou monitoramento</p></div>
    </div>
    <div className="card"><h1>Coortes dos últimos seis meses</h1><p className="subtitle">Conversão representa o estado atual das empresas criadas em cada mês; ativação exige ao menos um título lançado.</p><table><thead><tr><th>Mês</th><th>Empresas</th><th>Ativadas</th><th>Convertidas</th><th>Taxa de ativação</th><th>Taxa de conversão</th></tr></thead><tbody>{metrics.cohorts.map((item)=><tr key={item.month}><td>{monthLabel(item.month)}</td><td>{item.companies}</td><td>{item.activated}</td><td>{item.converted}</td><td>{percent(item.companies?item.activated/item.companies:0)}</td><td>{percent(item.companies?item.converted/item.companies:0)}</td></tr>)}</tbody></table></div>
  </main>;
}
