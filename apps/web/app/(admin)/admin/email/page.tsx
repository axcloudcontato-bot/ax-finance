import { redirect } from "next/navigation";
import { EnvelopeSimple, Mail, ShieldCheck } from "@/components/ui/animated-icons";
import { getPlatformAdminAccess, getSmtpSettingsForAdmin } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { loginPathFor } from "@/lib/auth-return";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { SmtpProviderPreset } from "@/components/admin/smtp-provider-preset";
import { SubmitButton } from "@/components/ui/submit-button";
import { saveSmtpSettingsAction, sendSmtpTestAction } from "./actions";

const FORM_ID = "smtp-settings-form";

const SOURCE = {
  database: { label: "Configuração do painel", tone: "is-success" },
  environment: { label: "Variáveis do servidor (.env)", tone: "is-info" },
  none: { label: "Não configurado", tone: "is-danger" },
} as const;

/** "Nome" <email> → partes para o formulário. */
function splitFrom(value: string | undefined) {
  if (!value) return { name: "AX Finance", email: "" };
  const match = value.match(/^"?([^"<]*?)"?\s*<([^>]+)>$/);
  return match ? { name: match[1]!.trim(), email: match[2]!.trim() } : { name: "", email: value.trim() };
}

export default async function AdminEmailPage(props: { searchParams: Promise<{ erro?: string; salvo?: string; erroTeste?: string; testado?: string }> }) {
  const searchParams = await props.searchParams;
  const user = await getCurrentUser();
  if (!user) redirect(loginPathFor("/admin/email"));
  const access = await getPlatformAdminAccess(user.id);
  if (!access) redirect("/dashboard");
  if (access.role !== "SUPER_ADMIN" && access.role !== "OPERATIONS") redirect("/admin");
  const data = await getSmtpSettingsForAdmin(user.id);
  const canEdit = access.role === "SUPER_ADMIN";
  const stored = data.stored;
  const from = splitFrom(stored?.fromAddress);
  const source = SOURCE[data.source];
  const active = data.source === "database" && stored
    ? { host: `${stored.host}:${stored.port}`, from: stored.fromAddress }
    : data.environment ? { host: `${data.environment.host}:${data.environment.port}`, from: data.environment.from } : null;

  return (
    <main className="admin-content">
      <AdminPageHeader eyebrow="Configurações" title="E-mail (SMTP)" description="Servidor usado para todos os e-mails do AX Finance: confirmação de conta, senha, convites, resumos e relatórios." />
      {searchParams.erro ? <div className="admin-alert is-error">{searchParams.erro}</div> : null}
      {searchParams.salvo ? <div className="admin-alert is-success">Configuração salva. O worker passa a usá-la em até um minuto. A alteração foi auditada.</div> : null}
      {searchParams.erroTeste ? <div className="admin-alert is-error">{searchParams.erroTeste}</div> : null}
      {searchParams.testado ? <div className="admin-alert is-success">E-mail de teste enviado para {searchParams.testado}. Confira a caixa de entrada (e o spam).</div> : null}

      <section className="admin-panel">
        <div className="admin-panel-heading compact">
          <div><span className="admin-panel-kicker">Em uso agora</span><h2>{active ? active.host : "Nenhum servidor"}</h2><p>{active ? `Remetente: ${active.from}` : "Sem servidor de e-mail, o worker não consegue enviar nada em produção."}</p></div>
          <span className={`admin-badge ${source.tone}`}>{source.label}</span>
        </div>
        <div className="admin-smtp-status">
          <p>{data.source === "database"
            ? "Os envios usam os dados salvos abaixo. Desligando \"Usar esta configuração\", o sistema volta para as variáveis SMTP_* do servidor."
            : data.source === "environment"
              ? "Os envios usam as variáveis SMTP_* do .env do servidor. Ao salvar uma configuração aqui, ela passa a valer no lugar delas."
              : "Preencha os dados do provedor de e-mail abaixo e envie um teste."}</p>
          <form action={sendSmtpTestAction} className="admin-smtp-test">
            <SubmitButton disabled={data.source === "none"} pendingLabel="Enviando…"><EnvelopeSimple size={15} />Enviar e-mail de teste</SubmitButton>
            <small>Vai para {user.email}</small>
          </form>
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-heading compact">
          <div><span className="admin-panel-kicker">Servidor</span><h2>Dados do SMTP</h2><p>{stored?.updatedByName ? `Última alteração por ${stored.updatedByName} em ${stored.updatedAt.toLocaleString("pt-BR")}.` : "Ainda não há configuração salva pelo painel."}</p></div>
          <span className="admin-panel-icon"><Mail size={19} /></span>
        </div>
        {canEdit ? (
          <form id={FORM_ID} action={saveSmtpSettingsAction} className="admin-smtp-form">
            <div className="admin-smtp-preset span-2">
              <SmtpProviderPreset formId={FORM_ID} />
              <small id={`${FORM_ID}-hint`} className="admin-muted">Escolha um provedor para preencher servidor e porta, ou preencha à mão.</small>
            </div>
            <div>
              <label htmlFor="smtp-host">Servidor</label>
              <input id="smtp-host" name="host" required maxLength={255} placeholder="smtp.seuprovedor.com" defaultValue={stored?.host ?? ""} autoComplete="off" />
            </div>
            <div className="admin-smtp-pair">
              <div>
                <label htmlFor="smtp-port">Porta</label>
                <input id="smtp-port" name="port" type="number" min={1} max={65535} required defaultValue={stored?.port ?? 587} />
              </div>
              <div>
                <label htmlFor="smtp-security">Segurança</label>
                <select id="smtp-security" name="security" defaultValue={stored?.secure ? "ssl" : "starttls"}>
                  <option value="starttls">STARTTLS (porta 587)</option>
                  <option value="ssl">SSL/TLS (porta 465)</option>
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="smtp-username">Usuário</label>
              <input id="smtp-username" name="username" maxLength={255} placeholder="Geralmente o e-mail da conta" defaultValue={stored?.username ?? ""} autoComplete="off" />
            </div>
            <div>
              <label htmlFor="smtp-password">Senha</label>
              <input id="smtp-password" name="password" type="password" maxLength={500} autoComplete="new-password" placeholder={stored?.hasPassword ? "Senha salva — deixe em branco para manter" : "Senha ou chave SMTP"} />
              {stored?.hasPassword ? <label className="admin-smtp-check"><input type="checkbox" name="clearPassword" />Remover a senha salva</label> : null}
            </div>
            <div>
              <label htmlFor="smtp-from-name">Nome do remetente</label>
              <input id="smtp-from-name" name="fromName" maxLength={120} defaultValue={from.name} placeholder="AX Finance" />
            </div>
            <div>
              <label htmlFor="smtp-from-email">E-mail do remetente</label>
              <input id="smtp-from-email" name="fromEmail" type="email" required maxLength={255} defaultValue={from.email} placeholder="no-reply@seudominio.com.br" />
            </div>
            <div className="admin-smtp-footer span-2">
              <label className="admin-smtp-check"><input type="checkbox" name="enabled" defaultChecked={stored ? stored.enabled : true} />Usar esta configuração para os envios</label>
              <SubmitButton pendingLabel="Salvando…">Salvar configuração</SubmitButton>
            </div>
            <div className="admin-smtp-note span-2"><ShieldCheck size={15} />A senha é guardada cifrada e nunca é mostrada de novo. O domínio do remetente precisa estar autorizado no provedor (SPF/DKIM) para os e-mails não caírem no spam.</div>
          </form>
        ) : (
          <div className="admin-smtp-status"><p>Somente o super administrador altera estes dados. Você pode enviar um e-mail de teste com a configuração em uso.</p></div>
        )}
      </section>
    </main>
  );
}
