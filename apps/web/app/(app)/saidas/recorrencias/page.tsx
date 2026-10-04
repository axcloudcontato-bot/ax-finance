import Link from "next/link";
import { redirect } from "next/navigation";
import { Repeat } from "@/components/ui/animated-icons";
import { listActiveCategories, listCostCenters, listParties, listRecurrenceRules } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { filterCategoriesByTitleType, sortCategoriesTree } from "@/lib/categories";
import { formatCents } from "@/lib/currency";
import { formatDateOnly } from "@/lib/dates";
import { Modal } from "@/components/ui/modal";
import { RecurrenceForm } from "@/components/recurrences/recurrence-form";
import {
  createSaidaRecurrenceAction,
  generateSaidaOccurrencesAction,
  pauseSaidaRecurrenceAction,
  resumeSaidaRecurrenceAction,
} from "./actions";
import { SubmitButton } from "@/components/ui/submit-button";

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Ativa",
  PAUSED: "Pausada",
  CANCELLED: "Cancelada",
};

export default async function SaidasRecorrenciasPage(
  props: {
    searchParams: Promise<{ erro?: string; gerados?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const company = await requirePrimaryCompany(user.id);

  const [rules, categories, suppliers, costCenters] = await Promise.all([
    listRecurrenceRules(user.id, company.id, { type: "PAYABLE" }),
    listActiveCategories(user.id, company.id),
    listParties(user.id, company.id, { role: "SUPPLIER", status: "ACTIVE" }),
    listCostCenters(user.id, company.id),
  ]);
  const activeRuleCount = rules.filter((rule) => rule.status === "ACTIVE").length;

  return (
    <main className="wide">
      <div className="page-header">
        <h1>Recorrências de saída</h1>
        <Modal
          triggerLabel="+ Nova recorrência"
          triggerClassName="button-link workspace-primary-action"
          title="Nova recorrência"
          icon={<Repeat className="size-5" strokeWidth={1.5} />}
          maxWidth="600px"
        >
          <RecurrenceForm
            action={createSaidaRecurrenceAction}
            categories={sortCategoriesTree(filterCategoriesByTitleType(categories, "PAYABLE"))}
            parties={suppliers}
            costCenters={costCenters}
            partyLabel="Fornecedor"
            error={searchParams.erro}
          />
        </Modal>
      </div>

      <div className="card">
        <div className="workspace-card-heading">
          <div><h2>Regras cadastradas</h2><p>{activeRuleCount} {activeRuleCount === 1 ? "ativa" : "ativas"} de {rules.length}</p></div>
          <form action={generateSaidaOccurrencesAction}>
            <SubmitButton className="secondary" disabled={activeRuleCount === 0}>
              Gerar títulos pendentes
            </SubmitButton>
          </form>
        </div>
        {searchParams.gerados ? (
          <p className="success-box">{searchParams.gerados} título(s) gerado(s) agora.</p>
        ) : null}

        {rules.length === 0 ? (
          <div className="workspace-empty"><strong>Nenhuma recorrência cadastrada</strong><p>Crie uma regra para gerar saídas nos próximos vencimentos.</p></div>
        ) : (
          <div className="table-scroll"><table className="workspace-table">
            <thead>
              <tr>
                <th>Descrição</th>
                <th className="money">Valor</th>
                <th>Dia</th>
                <th>Início</th>
                <th>Status</th>
                <th><span className="sr-only">Ação</span></th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id}>
                  <td>
                    <Link href={`/saidas/recorrencias/${rule.id}`}>{rule.description}</Link>
                  </td>
                  <td className="money">{formatCents(rule.amountCents)}</td>
                  <td>{rule.dayOfMonth}</td>
                  <td>{formatDateOnly(rule.startDate)}</td>
                  <td><span className={`workspace-status ${rule.status === "ACTIVE" ? "is-active" : ""}`}>{STATUS_LABEL[rule.status] ?? rule.status}</span></td>
                  <td>
                    {rule.status === "ACTIVE" ? (
                      <form action={pauseSaidaRecurrenceAction} className="inline">
                        <input type="hidden" name="ruleId" value={rule.id} />
                        <SubmitButton className="secondary">
                          Pausar
                        </SubmitButton>
                      </form>
                    ) : rule.status === "PAUSED" ? (
                      <form action={resumeSaidaRecurrenceAction} className="inline">
                        <input type="hidden" name="ruleId" value={rule.id} />
                        <SubmitButton className="secondary">
                          Retomar
                        </SubmitButton>
                      </form>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>
    </main>
  );
}
