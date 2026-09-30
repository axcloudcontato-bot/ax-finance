import { redirect } from "next/navigation";
import { Clock3, LifeBuoy, Mail, ShieldCheck } from "@/components/ui/animated-icons";
import { listCompanySupportCases } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { createSupportCaseAction } from "./actions";

const STATUS: Record<string,string> = { OPEN:"Aberto", IN_PROGRESS:"Em atendimento", WAITING_CUSTOMER:"Aguardando resposta", RESOLVED:"Resolvido", CLOSED:"Encerrado" };
const PRIORITY: Record<string,string> = { LOW:"Baixa", NORMAL:"Normal", HIGH:"Alta", URGENT:"Crítica" };
const dateTime = (value: Date) => value.toLocaleString("pt-BR", { dateStyle:"short", timeStyle:"short" });

export default async function CustomerSupportPage(props:{ searchParams: Promise<{ erro?:string; criado?:string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?retorno=%2Fconfiguracoes%2Fsuporte");
  const company = await requirePrimaryCompany(user.id);
  const [cases, query] = await Promise.all([listCompanySupportCases(user.id, company.id), props.searchParams]);
  return <main className="wide settings-page">
    <div className="page-header"><div><h1>Suporte</h1><p className="subtitle">Abra e acompanhe chamados de {company.name}.</p></div></div>
    {query.criado ? <p className="success-box">Chamado criado. A equipe responderá pelo e-mail da sua conta.</p> : null}
    {query.erro ? <p className="error">{query.erro}</p> : null}
    <div className="settings-grid support-settings-grid">
      <section className="card settings-panel">
        <div className="settings-panel-header"><span className="settings-icon"><LifeBuoy className="size-5" /></span><div><h2>Novo chamado</h2><p>Informe o contexto sem anexar dados sensíveis.</p></div></div>
        <form action={createSupportCaseAction} className="support-form">
          <label>Assunto<input name="subject" required minLength={5} maxLength={200} placeholder="Ex.: importação não concluiu" /></label>
          <label>Prioridade<select name="priority" defaultValue="NORMAL"><option value="LOW">Baixa — dúvida ou orientação</option><option value="NORMAL">Normal — problema com alternativa</option><option value="HIGH">Alta — fluxo principal bloqueado</option></select></label>
          <label>Descrição<textarea name="summary" required minLength={20} maxLength={4000} rows={7} placeholder="O que você esperava, o que aconteceu, quando e em qual tela?" /></label>
          <div className="settings-info-note"><ShieldCheck className="size-4" /> Nunca envie senha, código MFA, token, chave de API ou extrato completo.</div>
          <button type="submit">Abrir chamado</button>
        </form>
      </section>
      <aside className="card settings-panel support-policy-card">
        <div className="settings-panel-header"><span className="settings-icon orange"><Clock3 className="size-5" /></span><div><h2>Política de atendimento</h2><p>Dias úteis, das 9h às 18h, horário de Brasília.</p></div></div>
        <ul className="settings-feature-list"><li><strong>Alta</strong><span>Primeira resposta em até 1 dia útil.</span></li><li><strong>Normal</strong><span>Primeira resposta em até 2 dias úteis.</span></li><li><strong>Canal alternativo</strong><div className="support-email-row"><Mail className="size-4" /> contato@axcloud.com.br</div></li></ul>
        <a href="/suporte" className="button-link secondary">Ler política completa</a>
      </aside>
    </div>
    <section className="card support-history"><h2>Seus chamados</h2>{cases.length ? <div className="responsive-table"><table><thead><tr><th>Assunto</th><th>Prioridade</th><th>Status</th><th>Atualização</th></tr></thead><tbody>{cases.map(item=><tr key={item.id}><td><strong>{item.subject}</strong><small>{item.resolution || item.summary}</small></td><td>{PRIORITY[item.priority]}</td><td><span className="badge">{STATUS[item.status]}</span></td><td>{dateTime(item.updatedAt)}</td></tr>)}</tbody></table></div> : <p className="muted">Nenhum chamado aberto por esta empresa.</p>}</section>
  </main>;
}
