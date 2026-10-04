import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CompanyAccessDeniedError,
  RecurrenceRuleNotFoundError,
  getRecurrenceRule,
  listOccurrenceTitles,
} from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { formatCents } from "@/lib/currency";
import { formatDateOnly } from "@/lib/dates";
import { TitleStatusBadge } from "@/components/titles/title-status-badge";
import {
  cancelEntradaRecurrenceAction,
  generateEntradaOccurrencesAction,
  pauseEntradaRecurrenceAction,
  resumeEntradaRecurrenceAction,
} from "../actions";
import { SubmitButton } from "@/components/ui/submit-button";
import { ActionModal } from "@/components/ui/action-modal";

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Ativa",
  PAUSED: "Pausada",
  CANCELLED: "Cancelada",
};

export default async function EntradaRecorrenciaDetailPage(
  props: {
    params: Promise<{ ruleId: string }>;
    searchParams: Promise<{ gerados?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const company = await requirePrimaryCompany(user.id);

  let rule: Awaited<ReturnType<typeof getRecurrenceRule>>;
  try {
    rule = await getRecurrenceRule(user.id, company.id, params.ruleId);
  } catch (error) {
    if (error instanceof RecurrenceRuleNotFoundError || error instanceof CompanyAccessDeniedError) {
      redirect("/entradas/recorrencias");
    }
    throw error;
  }

  const titles = await listOccurrenceTitles(user.id, company.id, rule.id);

  return (
    <main className="wide record-detail">
      <nav className="record-detail-nav" aria-label="Navegação da recorrência"><Link href="/entradas/recorrencias">← Recorrências de entrada</Link><span>/</span><span>Detalhe da regra</span></nav>
      <div className="card">
        <div className="page-header record-detail-header">
          <div className="record-detail-heading"><span className="record-detail-eyebrow">Recorrência de entrada</span><h1>{rule.description}</h1><p className="subtitle">{rule.category.parentId ? "↳ " : ""}{rule.category.name}{rule.party ? ` · ${rule.party.name}` : ""}</p></div>
          <span className={`workspace-status ${rule.status === "ACTIVE" ? "is-active" : ""}`}>
            {STATUS_LABEL[rule.status] ?? rule.status}
          </span>
        </div>

        {searchParams.gerados ? (
          <p className="success-box">{searchParams.gerados} título(s) gerado(s) agora.</p>
        ) : null}

        <div className="record-detail-metrics">
          <div className="record-detail-metric is-primary"><span>Valor por ocorrência</span><strong>{formatCents(rule.amountCents)}</strong><small>Programado pela regra</small></div>
          <div className="record-detail-metric"><span>Dia de vencimento</span><strong>Dia {rule.dayOfMonth}</strong><small>Em cada mês previsto</small></div>
          <div className="record-detail-metric"><span>Títulos gerados</span><strong>{titles.length}</strong><small>Desde o início da regra</small></div>
        </div>
        <dl className="record-detail-facts">
          <div><dt>Início</dt><dd>{formatDateOnly(rule.startDate)}</dd></div>
          {rule.endDate ? <div><dt>Término</dt><dd>{formatDateOnly(rule.endDate)}</dd></div> : null}
          {rule.notes ? <div><dt>Observações</dt><dd>{rule.notes}</dd></div> : null}
        </dl>

        <div className="record-detail-inline-actions">
          <form action={generateEntradaOccurrencesAction}>
            <input type="hidden" name="returnTo" value={`/entradas/recorrencias/${rule.id}`} />
            <SubmitButton className="secondary" disabled={rule.status !== "ACTIVE"}>
              Gerar títulos pendentes
            </SubmitButton>
          </form>

          {rule.status === "ACTIVE" ? (
            <form action={pauseEntradaRecurrenceAction}>
              <input type="hidden" name="ruleId" value={rule.id} />
              <SubmitButton className="secondary">
                Pausar
              </SubmitButton>
            </form>
          ) : null}

          {rule.status === "PAUSED" ? (
            <form action={resumeEntradaRecurrenceAction}>
              <input type="hidden" name="ruleId" value={rule.id} />
              <SubmitButton className="secondary">
                Retomar
              </SubmitButton>
            </form>
          ) : null}
        </div>

        {rule.status !== "CANCELLED" ? (
          <details className="record-detail-more">
            <summary>Mais ações</summary>
            <div className="record-detail-more-actions">
              <ActionModal triggerLabel="Cancelar recorrência" title="Cancelar recorrência de entrada">
                <p className="subtitle">A regra deixará de gerar novos títulos. Você pode escolher se cancela também os títulos abertos já gerados.</p>
                <form action={cancelEntradaRecurrenceAction}>
                  <input type="hidden" name="ruleId" value={rule.id} />
                  <label htmlFor="cancel-entry-rule-reason">Motivo</label>
                  <input id="cancel-entry-rule-reason" name="reason" type="text" maxLength={500} required />
                  <label className="record-detail-checkbox"><input name="alsoCancelOpenTitles" type="checkbox" value="true" /> Também cancelar títulos abertos já gerados (sem baixa)</label>
                  <SubmitButton className="secondary">Confirmar cancelamento</SubmitButton>
                </form>
              </ActionModal>
            </div>
          </details>
        ) : null}
      </div>

      <div className="card">
        <h2>Títulos gerados</h2>
        {titles.length === 0 ? (
          <p className="muted">Nenhum título gerado ainda.</p>
        ) : (
          <table className="workspace-table">
            <thead>
              <tr>
                <th>Vencimento</th>
                <th className="money">Saldo aberto</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {titles.map((title) => (
                <tr key={title.id}>
                  <td>
                    <Link href={`/entradas/${title.id}`}>{formatDateOnly(title.dueDate)}</Link>
                  </td>
                  <td className="money">{formatCents(title.remainingCents, title.currency)}</td>
                  <td>
                    <TitleStatusBadge status={title.status} dueDate={title.dueDate} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
