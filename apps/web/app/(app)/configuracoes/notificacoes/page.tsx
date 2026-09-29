import { redirect } from "next/navigation";
import { BellRing, CalendarClock, Mail, ShieldCheck } from "lucide-react";
import { getNotificationPreference } from "@ax-finance/domain";
import { requirePrimaryCompany } from "@/lib/company";
import { getCurrentUser } from "@/lib/session";
import { updateNotificationPreferenceAction } from "./actions";

export default async function NotificationSettingsPage(
  props: {
    searchParams: Promise<{ salvo?: string; erro?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await requirePrimaryCompany(user.id);
  const preference = await getNotificationPreference(user.id, company.id);

  return (
    <main className="wide settings-page">
      <div className="page-header">
        <div>
          <h1>Notificações</h1>
          <p className="subtitle">Escolha quando e onde receber os alertas de {company.name}.</p>
        </div>
      </div>
      {searchParams.salvo ? <p className="success-box">Preferências salvas.</p> : null}
      {searchParams.erro ? <p className="error">{searchParams.erro}</p> : null}

      <form action={updateNotificationPreferenceAction} className="notification-settings-form settings-form">
        <section className="card settings-callout">
          <span className="settings-icon"><ShieldCheck className="size-5" /></span>
          <div>
            <h2>Avisos operacionais sempre ativos</h2>
            <p>
              Convites, falhas de importação, alterações de acesso e eventos da assinatura são
              comunicações transacionais de segurança e cobrança. Elas continuam na campainha e por e-mail.
            </p>
          </div>
        </section>

        <div className="settings-grid">
          <section className="card settings-panel">
            <div className="settings-panel-header">
              <span className="settings-icon teal"><BellRing className="size-5" /></span>
              <div><h2>Vencimentos</h2><p>Alertas de títulos vencidos, do dia e próximos.</p></div>
            </div>
            <div className="settings-choice-grid">
              <label className="notification-channel">
                <input name="inAppDue" type="checkbox" defaultChecked={preference.inAppDue} />
                <span><strong>Central de notificações</strong><small>Exibir na campainha do AX Finance.</small></span>
              </label>
              <label className="notification-channel">
                <input name="emailDue" type="checkbox" defaultChecked={preference.emailDue} />
                <span><strong>E-mail</strong><small>Enviar um resumo diário sem duplicar títulos.</small></span>
              </label>
            </div>
            <div className="settings-field">
              <label htmlFor="dueDaysAhead">Antecedência do aviso</label>
              <select id="dueDaysAhead" name="dueDaysAhead" defaultValue={preference.dueDaysAhead}>
                <option value="0">No dia do vencimento</option>
                <option value="1">1 dia antes</option>
                <option value="3">3 dias antes</option>
                <option value="5">5 dias antes</option>
                <option value="7">7 dias antes</option>
                <option value="15">15 dias antes</option>
                <option value="30">30 dias antes</option>
              </select>
            </div>
          </section>

          <section className="card settings-panel">
            <div className="settings-panel-header">
              <span className="settings-icon orange"><CalendarClock className="size-5" /></span>
              <div><h2>Resumo semanal</h2><p>Visão consolidada enviada às segundas-feiras.</p></div>
            </div>
            <div className="settings-choice-grid">
              <label className="notification-channel">
                <input name="inAppWeekly" type="checkbox" defaultChecked={preference.inAppWeekly} />
                <span><strong>Central de notificações</strong><small>Disponibilizar o resumo na campainha.</small></span>
              </label>
              <label className="notification-channel">
                <input name="emailWeekly" type="checkbox" defaultChecked={preference.emailWeekly} />
                <span><strong>E-mail</strong><small>Totais em aberto, vencidos e próximos 7 dias.</small></span>
              </label>
            </div>
            <div className="settings-field">
              <label htmlFor="deliveryHour"><Mail className="size-4" /> Horário de entrega</label>
              <select id="deliveryHour" name="deliveryHour" defaultValue={preference.deliveryHour}>
                {Array.from({ length: 24 }, (_, hour) => (
                  <option key={hour} value={hour}>{String(hour).padStart(2, "0")}:00</option>
                ))}
              </select>
              <small>Fuso de {company.timezone}. O envio ocorre na primeira execução disponível após o horário.</small>
            </div>
          </section>
        </div>

        <div className="settings-save-bar">
          <div><strong>Preferências de {company.name}</strong><span>As alterações valem para o seu usuário nesta empresa.</span></div>
          <button type="submit">Salvar preferências</button>
        </div>
      </form>
    </main>
  );
}
