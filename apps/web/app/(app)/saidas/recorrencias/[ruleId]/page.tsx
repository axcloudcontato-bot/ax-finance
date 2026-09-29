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
  cancelSaidaRecurrenceAction,
  generateSaidaOccurrencesAction,
  pauseSaidaRecurrenceAction,
  resumeSaidaRecurrenceAction,
} from "../actions";

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Ativa",
  PAUSED: "Pausada",
  CANCELLED: "Cancelada",
};

export default async function SaidaRecorrenciaDetailPage(
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
      redirect("/saidas/recorrencias");
    }
    throw error;
  }

  const titles = await listOccurrenceTitles(user.id, company.id, rule.id);

  return (
    <main className="wide">
      <div className="card">
        <div className="page-header" style={{ marginBottom: "0.5rem" }}>
          <h1>{rule.description}</h1>
          <span className="subtitle" style={{ marginBottom: 0 }}>
            {STATUS_LABEL[rule.status] ?? rule.status}
          </span>
        </div>
        <p className="subtitle">
          {rule.category.parentId ? "↳ " : ""}
          {rule.category.name}
          {rule.party ? ` · ${rule.party.name}` : ""}
        </p>

        {searchParams.gerados ? (
          <p className="subtitle">{searchParams.gerados} título(s) gerado(s) agora.</p>
        ) : null}

        <table>
          <tbody>
            <tr>
              <td>Valor mensal</td>
              <td>{formatCents(rule.amountCents)}</td>
            </tr>
            <tr>
              <td>Dia de vencimento</td>
              <td>{rule.dayOfMonth}</td>
            </tr>
            <tr>
              <td>Início</td>
              <td>{formatDateOnly(rule.startDate)}</td>
            </tr>
            {rule.endDate ? (
              <tr>
                <td>Término</td>
                <td>{formatDateOnly(rule.endDate)}</td>
              </tr>
            ) : null}
            {rule.notes ? (
              <tr>
                <td>Observações</td>
                <td>{rule.notes}</td>
              </tr>
            ) : null}
          </tbody>
        </table>

        <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem", flexWrap: "wrap" }}>
          <form action={generateSaidaOccurrencesAction}>
            <input type="hidden" name="returnTo" value={`/saidas/recorrencias/${rule.id}`} />
            <button type="submit" className="secondary">
              Gerar títulos pendentes
            </button>
          </form>

          {rule.status === "ACTIVE" ? (
            <form action={pauseSaidaRecurrenceAction}>
              <input type="hidden" name="ruleId" value={rule.id} />
              <button type="submit" className="secondary">
                Pausar
              </button>
            </form>
          ) : null}

          {rule.status === "PAUSED" ? (
            <form action={resumeSaidaRecurrenceAction}>
              <input type="hidden" name="ruleId" value={rule.id} />
              <button type="submit" className="secondary">
                Retomar
              </button>
            </form>
          ) : null}
        </div>

        {rule.status !== "CANCELLED" ? (
          <form action={cancelSaidaRecurrenceAction} style={{ marginTop: "1rem" }}>
            <input type="hidden" name="ruleId" value={rule.id} />
            <label htmlFor="reason">Cancelar recorrência — motivo</label>
            <input id="reason" name="reason" type="text" maxLength={500} required />
            <div style={{ marginTop: "0.75rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <input
                id="alsoCancelOpenTitles"
                name="alsoCancelOpenTitles"
                type="checkbox"
                value="true"
                style={{ width: "auto" }}
              />
              <label htmlFor="alsoCancelOpenTitles" style={{ margin: 0 }}>
                Também cancelar títulos abertos já gerados (sem baixa)
              </label>
            </div>
            <button type="submit" className="secondary" style={{ marginTop: "1rem" }}>
              Cancelar recorrência
            </button>
          </form>
        ) : null}
      </div>

      <div className="card">
        <h1>Títulos gerados</h1>
        {titles.length === 0 ? (
          <p className="muted">Nenhum título gerado ainda.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Vencimento</th>
                <th>Saldo aberto</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {titles.map((title) => (
                <tr key={title.id}>
                  <td>
                    <Link href={`/saidas/${title.id}`}>{formatDateOnly(title.dueDate)}</Link>
                  </td>
                  <td>{formatCents(title.remainingCents, title.currency)}</td>
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
