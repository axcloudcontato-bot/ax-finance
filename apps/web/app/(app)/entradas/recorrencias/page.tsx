import Link from "next/link";
import { redirect } from "next/navigation";
import { Repeat } from "lucide-react";
import { listActiveCategories, listCostCenters, listParties, listRecurrenceRules } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { filterCategoriesByTitleType, sortCategoriesTree } from "@/lib/categories";
import { formatCents } from "@/lib/currency";
import { formatDateOnly } from "@/lib/dates";
import { Modal } from "@/components/ui/modal";
import { RecurrenceForm } from "@/components/recurrences/recurrence-form";
import {
  createEntradaRecurrenceAction,
  generateEntradaOccurrencesAction,
  pauseEntradaRecurrenceAction,
  resumeEntradaRecurrenceAction,
} from "./actions";

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Ativa",
  PAUSED: "Pausada",
  CANCELLED: "Cancelada",
};

export default async function EntradasRecorrenciasPage({
  searchParams,
}: {
  searchParams: { erro?: string; gerados?: string };
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const company = await requirePrimaryCompany(user.id);

  const [rules, categories, clients, costCenters] = await Promise.all([
    listRecurrenceRules(user.id, company.id, { type: "RECEIVABLE" }),
    listActiveCategories(user.id, company.id),
    listParties(user.id, company.id, { role: "CLIENT", status: "ACTIVE" }),
    listCostCenters(user.id, company.id),
  ]);

  return (
    <main className="wide">
      <div className="page-header">
        <h1>Recorrências de entrada</h1>
        <Modal
          triggerLabel="+ Nova recorrência"
          title="Nova recorrência"
          icon={<Repeat className="size-5" strokeWidth={1.5} />}
          maxWidth="600px"
        >
          <RecurrenceForm
            action={createEntradaRecurrenceAction}
            categories={sortCategoriesTree(filterCategoriesByTitleType(categories, "RECEIVABLE"))}
            parties={clients}
            costCenters={costCenters}
            partyLabel="Cliente"
            error={searchParams.erro}
          />
        </Modal>
      </div>

      <div className="card">
        <div className="page-header" style={{ marginBottom: "0.5rem" }}>
          <h1>Regras cadastradas</h1>
          <form action={generateEntradaOccurrencesAction}>
            <button type="submit" className="secondary">
              Gerar títulos pendentes
            </button>
          </form>
        </div>
        {searchParams.gerados ? (
          <p className="subtitle">{searchParams.gerados} título(s) gerado(s) agora.</p>
        ) : null}

        {rules.length === 0 ? (
          <p className="muted">Nenhuma recorrência cadastrada ainda.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Descrição</th>
                <th>Valor</th>
                <th>Dia</th>
                <th>Início</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id}>
                  <td>
                    <Link href={`/entradas/recorrencias/${rule.id}`}>{rule.description}</Link>
                  </td>
                  <td>{formatCents(rule.amountCents)}</td>
                  <td>{rule.dayOfMonth}</td>
                  <td>{formatDateOnly(rule.startDate)}</td>
                  <td>{STATUS_LABEL[rule.status] ?? rule.status}</td>
                  <td>
                    {rule.status === "ACTIVE" ? (
                      <form action={pauseEntradaRecurrenceAction} className="inline">
                        <input type="hidden" name="ruleId" value={rule.id} />
                        <button type="submit" className="secondary">
                          Pausar
                        </button>
                      </form>
                    ) : rule.status === "PAUSED" ? (
                      <form action={resumeEntradaRecurrenceAction} className="inline">
                        <input type="hidden" name="ruleId" value={rule.id} />
                        <button type="submit" className="secondary">
                          Retomar
                        </button>
                      </form>
                    ) : null}
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
