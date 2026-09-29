import { redirect } from "next/navigation";
import { AlertTriangle, CircleHelp, Clock3, Flame, ShieldAlert } from "@/components/ui/animated-icons";
import { getPlatformAdminAccess, listAdminSupport } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { loginPathFor } from "@/lib/auth-return";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminStatCard } from "@/components/admin/admin-stat-card";
import { ActionModal } from "@/components/ui/action-modal";
import { createIncidentAction, createSupportCaseAction, updateIncidentAction, updateSupportCaseAction } from "./actions";

const CASE_STATUS: Record<string, string> = { OPEN: "Aberto", IN_PROGRESS: "Em atendimento", WAITING_CUSTOMER: "Aguardando cliente", RESOLVED: "Resolvido", CLOSED: "Fechado" };
const CASE_TONE: Record<string, string> = { OPEN: "info", IN_PROGRESS: "warning", WAITING_CUSTOMER: "violet", RESOLVED: "success", CLOSED: "neutral" };
const PRIORITY: Record<string, string> = { LOW: "Baixa", NORMAL: "Normal", HIGH: "Alta", URGENT: "Urgente" };
const PRIORITY_TONE: Record<string, string> = { LOW: "neutral", NORMAL: "info", HIGH: "warning", URGENT: "danger" };
const INCIDENT_STATUS: Record<string, string> = { INVESTIGATING: "Investigando", IDENTIFIED: "Identificado", MONITORING: "Monitorando", RESOLVED: "Resolvido" };
const INCIDENT_TONE: Record<string, string> = { INVESTIGATING: "danger", IDENTIFIED: "warning", MONITORING: "info", RESOLVED: "success" };

export default async function AdminSupportPage(
  props: { searchParams: Promise<{ erro?: string; criado?: string; atualizado?: string }> }
) {
  const searchParams = await props.searchParams;
  const user = await getCurrentUser();
  if (!user) redirect(loginPathFor("/admin/suporte"));
  const access = await getPlatformAdminAccess(user.id);
  if (!access) redirect("/dashboard");
  const data = await listAdminSupport(user.id);
  const canWrite = access.role !== "ANALYST";
  const openCases = data.cases.filter((item) => item.status !== "RESOLVED" && item.status !== "CLOSED").length;
  const urgentCases = data.cases.filter((item) => item.priority === "URGENT" && item.status !== "CLOSED").length;
  const activeIncidents = data.incidents.filter((item) => item.status !== "RESOLVED").length;
  const criticalIncidents = data.incidents.filter((item) => (item.severity === "SEV1" || item.severity === "SEV2") && item.status !== "RESOLVED").length;
  const companyOptions = <><option value="">Plataforma inteira / sem empresa</option>{data.companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</>;
  const adminOptions = <><option value="">Não atribuído</option>{data.admins.map((admin) => <option key={admin.userId} value={admin.userId}>{admin.user.name} · {admin.role}</option>)}</>;

  const actions = canWrite ? <>
    <ActionModal triggerLabel="Novo chamado" title="Novo chamado" icon={<CircleHelp size={20} />}>
      <form action={createSupportCaseAction}><label>Empresa</label><select name="companyId" defaultValue="">{companyOptions}</select><label>Assunto</label><input name="subject" required maxLength={200} /><label>Resumo</label><textarea name="summary" required maxLength={4000} /><label>Contato</label><input name="contactEmail" type="email" maxLength={200} /><label>Prioridade</label><select name="priority" defaultValue="NORMAL">{Object.entries(PRIORITY).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><label>Responsável</label><select name="assignedToUserId" defaultValue="">{adminOptions}</select><button type="submit">Criar chamado</button></form>
    </ActionModal>
    <ActionModal triggerLabel="Novo incidente" title="Novo incidente" icon={<AlertTriangle size={20} />}>
      <form action={createIncidentAction}><label>Empresa afetada</label><select name="companyId" defaultValue="">{companyOptions}</select><label>Título</label><input name="title" required maxLength={200} /><label>Severidade</label><select name="severity" defaultValue="SEV3"><option value="SEV1">SEV1 — crítico</option><option value="SEV2">SEV2 — alto</option><option value="SEV3">SEV3 — moderado</option><option value="SEV4">SEV4 — baixo</option></select><label>Mensagem pública</label><textarea name="publicMessage" required maxLength={2000} /><label>Resumo interno</label><textarea name="internalSummary" maxLength={4000} /><button type="submit">Abrir incidente</button></form>
    </ActionModal>
  </> : null;

  return (
    <main className="admin-content">
      <AdminPageHeader eyebrow="Atendimento e confiabilidade" title="Suporte e incidentes" description="Centralize demandas de clientes, responsáveis e comunicação de incidentes." actions={actions} />
      {searchParams.erro ? <div className="admin-alert is-error">{searchParams.erro}</div> : null}
      {searchParams.criado ? <div className="admin-alert is-success">Registro criado e adicionado à trilha de auditoria.</div> : null}
      {searchParams.atualizado ? <div className="admin-alert is-success">Registro atualizado e adicionado à trilha de auditoria.</div> : null}

      <section className="admin-stat-grid compact" aria-label="Resumo de suporte">
        <AdminStatCard label="Chamados abertos" value={openCases} detail={`${data.cases.length} chamados no total`} icon={<CircleHelp size={20} />} tone="blue" />
        <AdminStatCard label="Prioridade urgente" value={urgentCases} detail="Demandas que exigem resposta imediata" icon={<Flame size={20} />} tone={urgentCases ? "red" : "slate"} />
        <AdminStatCard label="Incidentes ativos" value={activeIncidents} detail={`${data.incidents.length} incidentes registrados`} icon={<ShieldAlert size={20} />} tone={activeIncidents ? "orange" : "green"} />
        <AdminStatCard label="Alta severidade" value={criticalIncidents} detail="Incidentes SEV1 ou SEV2 ativos" icon={<AlertTriangle size={20} />} tone={criticalIncidents ? "red" : "slate"} />
      </section>

      <section className="admin-panel">
        <div className="admin-panel-heading compact"><div><span className="admin-panel-kicker">Fila de atendimento</span><h2>Chamados</h2><p>Demandas internas e solicitações vinculadas a clientes.</p></div><span className="admin-count-badge">{data.cases.length} chamado(s)</span></div>
        {data.cases.length === 0 ? <div className="admin-empty-state"><span><CircleHelp size={24} /></span><h3>Nenhum chamado registrado</h3><p>Novas solicitações aparecerão aqui.</p></div> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Chamado</th><th>Empresa</th><th>Prioridade</th><th>Status</th><th>Responsável</th><th>Atualizado</th><th>Ações</th></tr></thead><tbody>{data.cases.map((item) => <tr key={item.id}><td><div className="admin-stacked-cell wide"><strong>{item.subject}</strong><small>{item.summary}</small></div></td><td>{item.company?.name ?? <span className="admin-muted">Plataforma</span>}</td><td><span className={`admin-badge is-${PRIORITY_TONE[item.priority]}`}>{PRIORITY[item.priority]}</span></td><td><span className={`admin-badge is-${CASE_TONE[item.status]}`}>{CASE_STATUS[item.status]}</span></td><td>{item.assignedTo?.name ?? <span className="admin-muted">Não atribuído</span>}</td><td><span className="admin-date-cell"><Clock3 size={15} />{item.updatedAt.toLocaleString("pt-BR")}</span></td><td>{canWrite ? <ActionModal triggerLabel="Atualizar" title={`Chamado — ${item.subject}`}><form action={updateSupportCaseAction.bind(null, item.id)}><label>Status</label><select name="status" defaultValue={item.status}>{Object.entries(CASE_STATUS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><label>Prioridade</label><select name="priority" defaultValue={item.priority}>{Object.entries(PRIORITY).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><label>Responsável</label><select name="assignedToUserId" defaultValue={item.assignedToUserId ?? ""}>{adminOptions}</select><label>Resolução/notas</label><textarea name="resolution" defaultValue={item.resolution ?? ""} maxLength={4000} /><button type="submit">Salvar chamado</button></form></ActionModal> : null}</td></tr>)}</tbody></table></div>}
      </section>

      <section className="admin-panel">
        <div className="admin-panel-heading compact"><div><span className="admin-panel-kicker">Status da plataforma</span><h2>Incidentes</h2><p>Acompanhamento de indisponibilidades e degradações.</p></div><span className="admin-count-badge">{data.incidents.length} incidente(s)</span></div>
        {data.incidents.length === 0 ? <div className="admin-empty-state"><span><ShieldAlert size={24} /></span><h3>Nenhum incidente registrado</h3><p>A operação está sem incidentes documentados.</p></div> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Incidente</th><th>Escopo</th><th>Severidade</th><th>Status</th><th>Início</th><th>Ações</th></tr></thead><tbody>{data.incidents.map((item) => <tr key={item.id}><td><div className="admin-stacked-cell wide"><strong>{item.title}</strong><small>{item.publicMessage}</small></div></td><td>{item.company?.name ?? <span className="admin-muted">Toda a plataforma</span>}</td><td><span className={`admin-badge ${item.severity === "SEV1" || item.severity === "SEV2" ? "is-danger" : "is-warning"}`}>{item.severity}</span></td><td><span className={`admin-badge is-${INCIDENT_TONE[item.status]}`}>{INCIDENT_STATUS[item.status]}</span></td><td>{item.startedAt.toLocaleString("pt-BR")}</td><td>{canWrite ? <ActionModal triggerLabel="Atualizar" title={`Incidente — ${item.title}`}><form action={updateIncidentAction.bind(null, item.id)}><label>Status</label><select name="status" defaultValue={item.status}>{Object.entries(INCIDENT_STATUS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><label>Severidade</label><select name="severity" defaultValue={item.severity}><option value="SEV1">SEV1</option><option value="SEV2">SEV2</option><option value="SEV3">SEV3</option><option value="SEV4">SEV4</option></select><label>Mensagem pública</label><textarea name="publicMessage" defaultValue={item.publicMessage} required maxLength={2000} /><label>Resumo interno</label><textarea name="internalSummary" defaultValue={item.internalSummary ?? ""} maxLength={4000} /><button type="submit">Salvar incidente</button></form></ActionModal> : null}</td></tr>)}</tbody></table></div>}
      </section>
    </main>
  );
}
