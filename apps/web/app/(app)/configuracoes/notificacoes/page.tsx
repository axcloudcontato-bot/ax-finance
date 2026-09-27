import { redirect } from "next/navigation";
import { getNotificationPreference } from "@ax-finance/domain";
import { requirePrimaryCompany } from "@/lib/company";
import { getCurrentUser } from "@/lib/session";
import { updateNotificationPreferenceAction } from "./actions";

export default async function NotificationSettingsPage({
  searchParams,
}: {
  searchParams: { salvo?: string; erro?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await requirePrimaryCompany(user.id);
  const preference = await getNotificationPreference(user.id, company.id);

  return (
    <main className="narrow">
      <div className="page-header">
        <div>
          <h1>Notificações</h1>
          <p className="subtitle">Escolha quando e onde receber os alertas de {company.name}.</p>
        </div>
      </div>
      {searchParams.salvo ? <p className="success-box">Preferências salvas.</p> : null}
      {searchParams.erro ? <p className="error">{searchParams.erro}</p> : null}

      <form action={updateNotificationPreferenceAction} className="card notification-settings-form">
        <h1>Avisos operacionais</h1>
        <p className="muted">
          Convites, falhas de importação, alterações de acesso e eventos da assinatura são
          comunicações transacionais de segurança e cobrança. Elas permanecem ativas na
          campainha e por e-mail e não são tratadas como marketing.
        </p>

        <h1>Vencimentos</h1>
        <p className="muted">Inclui títulos vencidos, do dia e dentro da antecedência escolhida.</p>
        <label className="notification-channel">
          <input name="inAppDue" type="checkbox" defaultChecked={preference.inAppDue} />
          <span><strong>Central de notificações</strong><small>Exibir na campainha do AX Finance.</small></span>
        </label>
        <label className="notification-channel">
          <input name="emailDue" type="checkbox" defaultChecked={preference.emailDue} />
          <span><strong>E-mail</strong><small>Enviar um resumo diário sem duplicar títulos.</small></span>
        </label>

        <label htmlFor="dueDaysAhead">Antecedência</label>
        <select id="dueDaysAhead" name="dueDaysAhead" defaultValue={preference.dueDaysAhead}>
          <option value="0">No dia do vencimento</option>
          <option value="1">1 dia antes</option>
          <option value="3">3 dias antes</option>
          <option value="5">5 dias antes</option>
          <option value="7">7 dias antes</option>
          <option value="15">15 dias antes</option>
          <option value="30">30 dias antes</option>
        </select>

        <h1 style={{ marginTop: "1.5rem" }}>Resumo semanal</h1>
        <label className="notification-channel">
          <input name="inAppWeekly" type="checkbox" defaultChecked={preference.inAppWeekly} />
          <span><strong>Central de notificações</strong><small>Resumo às segundas-feiras.</small></span>
        </label>
        <label className="notification-channel">
          <input name="emailWeekly" type="checkbox" defaultChecked={preference.emailWeekly} />
          <span><strong>E-mail</strong><small>Totais em aberto, vencidos e próximos 7 dias.</small></span>
        </label>

        <label htmlFor="deliveryHour">Horário de entrega</label>
        <select id="deliveryHour" name="deliveryHour" defaultValue={preference.deliveryHour}>
          {Array.from({ length: 24 }, (_, hour) => (
            <option key={hour} value={hour}>{String(hour).padStart(2, "0")}:00</option>
          ))}
        </select>
        <p className="muted">Horário de {company.timezone}. O envio acontece na primeira execução disponível após esse horário.</p>
        <button type="submit">Salvar preferências</button>
      </form>
    </main>
  );
}
