import { redirect } from "next/navigation";
import { Activity, CheckCircle2, Clock3, Database, FileWarning, History, MailWarning, RotateCcw } from "lucide-react";
import { getAdminOperations, getPlatformAdminAccess } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { loginPathFor } from "@/lib/auth-return";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminStatCard } from "@/components/admin/admin-stat-card";
import { reprocessDeadLetterAction, reprocessImportJobAction, reprocessScheduledJobAction } from "./actions";

const dateTime = (value: Date | null) => value ? value.toLocaleString("pt-BR") : "—";

function EmptyOperation({ children }: { children: string }) {
  return <div className="admin-empty-inline"><CheckCircle2 size={19} /><span>{children}</span></div>;
}

export default async function AdminOperationsPage({ searchParams }: { searchParams: { erro?: string; reprocessado?: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect(loginPathFor("/admin/operacoes"));
  const access = await getPlatformAdminAccess(user.id);
  if (!access) redirect("/dashboard");
  const data = await getAdminOperations(user.id);
  const canReprocess = access.role === "SUPER_ADMIN" || access.role === "OPERATIONS";

  return (
    <main className="admin-content">
      <AdminPageHeader eyebrow="Operação da plataforma" title="Diagnóstico e jobs" description="Monitore filas, identifique falhas e reprocese tarefas com segurança e auditoria." actions={<span className="admin-health-pill"><span />Serviços monitorados</span>} />
      {searchParams.erro ? <div className="admin-alert is-error">{searchParams.erro}</div> : null}
      {searchParams.reprocessado ? <div className="admin-alert is-success">Item recolocado na fila. A intervenção foi auditada.</div> : null}

      <section className="admin-stat-grid compact" aria-label="Saúde operacional">
        <AdminStatCard label="Latência do banco" value={`${data.diagnostics.databaseLatencyMs} ms`} detail="Tempo da última verificação" icon={<Database size={20} />} tone={data.diagnostics.databaseLatencyMs > 500 ? "orange" : "green"} />
        <AdminStatCard label="Outbox pendente" value={data.diagnostics.outbox.pending} detail={`${data.diagnostics.outbox.deadLetter} em dead letter`} icon={<MailWarning size={20} />} tone={data.diagnostics.outbox.deadLetter ? "red" : "blue"} />
        <AdminStatCard label="Jobs com falha" value={data.diagnostics.scheduledJobs.failing} detail={`${data.diagnostics.scheduledJobs.staleLocks} locks expirados`} icon={<Activity size={20} />} tone={data.diagnostics.scheduledJobs.failing ? "orange" : "green"} />
        <AdminStatCard label="Importações" value={data.diagnostics.importJobs.failed} detail={`${data.diagnostics.importJobs.pending} aguardando processamento`} icon={<FileWarning size={20} />} tone={data.diagnostics.importJobs.failed ? "red" : "violet"} />
      </section>

      <section className="admin-panel">
        <div className="admin-panel-heading compact"><div><span className="admin-panel-kicker">Agendamentos</span><h2>Jobs que exigem atenção</h2><p>Falhas, atrasos e locks expirados.</p></div><span className="admin-count-badge">{data.scheduledJobs.length} pendente(s)</span></div>
        {data.scheduledJobs.length === 0 ? <EmptyOperation>Nenhum job agendado requer intervenção.</EmptyOperation> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Empresa</th><th>Tipo</th><th>Tentativas</th><th>Próxima execução</th><th>Diagnóstico</th><th>Ação</th></tr></thead><tbody>{data.scheduledJobs.map((job) => <tr key={job.id}><td><strong className="admin-table-primary">{job.company.name}</strong></td><td><span className="admin-code-label">{job.type}</span></td><td><span className={`admin-badge ${job.attempts > 2 ? "is-danger" : "is-warning"}`}>{job.attempts}</span></td><td><span className="admin-date-cell"><Clock3 size={15} />{dateTime(job.nextRunAt)}</span></td><td><span className="admin-error-text">{job.lastError || "Sem detalhe disponível"}</span></td><td>{canReprocess ? <form action={reprocessScheduledJobAction.bind(null, job.id)} className="admin-reprocess-form"><input name="reason" placeholder="Motivo da intervenção" required maxLength={500} /><button type="submit" className="admin-icon-button"><RotateCcw size={16} />Reprocessar</button></form> : null}</td></tr>)}</tbody></table></div>}
      </section>

      <section className="admin-panel">
        <div className="admin-panel-heading compact"><div><span className="admin-panel-kicker">Conciliação</span><h2>Importações com falha</h2><p>Arquivos que não concluíram o processamento.</p></div><span className="admin-count-badge">{data.importJobs.length} pendente(s)</span></div>
        {data.importJobs.length === 0 ? <EmptyOperation>Nenhuma importação exige intervenção.</EmptyOperation> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Empresa</th><th>Arquivo</th><th>Status</th><th>Tentativas</th><th>Diagnóstico</th><th>Ação</th></tr></thead><tbody>{data.importJobs.map((job) => <tr key={job.id}><td><strong className="admin-table-primary">{job.company.name}</strong></td><td>{job.importBatch.fileName}</td><td><span className="admin-badge is-danger">{job.status}</span></td><td>{job.attempts}</td><td><span className="admin-error-text">{job.lastError || "Sem detalhe disponível"}</span></td><td>{canReprocess ? <form action={reprocessImportJobAction.bind(null, job.id)} className="admin-reprocess-form"><input name="reason" placeholder="Motivo da intervenção" required maxLength={500} /><button type="submit" className="admin-icon-button"><RotateCcw size={16} />Reprocessar</button></form> : null}</td></tr>)}</tbody></table></div>}
      </section>

      <section className="admin-panel">
        <div className="admin-panel-heading compact"><div><span className="admin-panel-kicker">Mensageria</span><h2>Outbox em dead letter</h2><p>Eventos que esgotaram as tentativas automáticas.</p></div><span className="admin-count-badge">{data.deadLetters.length} evento(s)</span></div>
        {data.deadLetters.length === 0 ? <EmptyOperation>Nenhum evento está em dead letter.</EmptyOperation> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Tipo</th><th>Tentativas</th><th>Atualizado</th><th>Diagnóstico</th><th>Ação</th></tr></thead><tbody>{data.deadLetters.map((event) => <tr key={event.id}><td><span className="admin-code-label">{event.type}</span></td><td>{event.attempts}</td><td>{dateTime(event.updatedAt)}</td><td><span className="admin-error-text">{event.lastError || "Sem detalhe disponível"}</span></td><td>{canReprocess && event.canReprocess ? <form action={reprocessDeadLetterAction.bind(null, event.id)} className="admin-reprocess-form"><input name="reason" placeholder="Motivo da intervenção" required maxLength={500} /><button type="submit" className="admin-icon-button"><RotateCcw size={16} />Reprocessar</button></form> : <span className="admin-muted">Payload indisponível</span>}</td></tr>)}</tbody></table></div>}
      </section>

      <section className="admin-panel">
        <div className="admin-panel-heading compact"><div><span className="admin-panel-kicker">Auditoria</span><h2>Intervenções recentes</h2><p>Histórico das ações executadas por administradores.</p></div><span className="admin-panel-icon"><History size={19} /></span></div>
        {data.auditEvents.length === 0 ? <div className="admin-empty-inline neutral"><History size={19} /><span>Nenhuma intervenção administrativa registrada.</span></div> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Data</th><th>Administrador</th><th>Ação</th><th>Alvo</th><th>Motivo</th></tr></thead><tbody>{data.auditEvents.map((event) => <tr key={event.id}><td>{dateTime(event.createdAt)}</td><td><div className="admin-stacked-cell"><strong>{event.actor.name}</strong><small>{event.actor.email}</small></div></td><td><span className="admin-badge is-info">{event.action}</span></td><td><span className="admin-code-label">{event.targetType}{event.targetId ? ` · ${event.targetId.slice(0, 8)}` : ""}</span></td><td>{event.summary}</td></tr>)}</tbody></table></div>}
      </section>
    </main>
  );
}
