import Link from "next/link";
import { redirect } from "next/navigation";
import { EVENT_TYPE_LABEL, listAuditEvents } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { isComparisonMode, periodQuery, resolvePeriodRange } from "@/lib/month";
import { requirePlanFeature } from "@/lib/plan-access";

const RESOURCE_LABEL: Record<string, string> = {
  Title: "Título",
  Transfer: "Transferência",
  Period: "Período",
  InstallmentGroup: "Parcelamento",
  FinancialAccount: "Conta",
};

function resourceHref(
  resourceType: string,
  resourceId: string,
  eventType: string,
  metadata: unknown
): string | null {
  // Título/parcelamento excluído não existe mais — não faz sentido linkar.
  if (eventType === "TITLE_DELETED" || eventType === "INSTALLMENT_PLAN_DELETED") {
    return null;
  }
  if (resourceType === "Title") {
    const titleType = (metadata as { titleType?: string } | null)?.titleType;
    return titleType === "PAYABLE" ? `/saidas/${resourceId}` : `/entradas/${resourceId}`;
  }
  if (resourceType === "Transfer") {
    return "/transferencias";
  }
  return null;
}

export default async function AuditoriaPage(
  props: {
    searchParams: Promise<{ tipo?: string; mes?: string; de?: string; ate?: string; periodo?: string; comparar?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const company = await requirePrimaryCompany(user.id);
  await requirePlanFeature(user.id, company.id, "AUDIT_LOG");

  const period = resolvePeriodRange(searchParams);
  const { from, to } = period;
  const resourceType = searchParams.tipo || undefined;

  const events = await listAuditEvents(user.id, company.id, { resourceType, from, to });

  const filterHref = (tipo?: string) => {
    const params = new URLSearchParams(periodQuery(period, isComparisonMode(searchParams.comparar) ? searchParams.comparar : null));
    if (tipo) params.set("tipo", tipo);
    const query = params.toString();
    return query ? `/auditoria?${query}` : "/auditoria";
  };

  return (
    <main className="wide">
      <div className="page-header"><div><h1>Auditoria</h1><p className="subtitle">Histórico de alterações e operações no período selecionado.</p></div></div>

      <div className="filters">
        <a href={filterHref(undefined)} className={!resourceType ? "active" : ""} aria-current={!resourceType ? "page" : undefined}>
          Todos
        </a>
        <a href={filterHref("Title")} className={resourceType === "Title" ? "active" : ""} aria-current={resourceType === "Title" ? "page" : undefined}>
          Títulos
        </a>
        <a href={filterHref("Transfer")} className={resourceType === "Transfer" ? "active" : ""} aria-current={resourceType === "Transfer" ? "page" : undefined}>
          Transferências
        </a>
      </div>

      <div className="card">
        <div className="workspace-list-toolbar"><p>{events.length} {events.length === 1 ? "evento encontrado" : "eventos encontrados"}</p></div>
        {events.length === 0 ? (
          <div className="workspace-empty"><strong>Nenhum evento encontrado</strong><p>Altere o período ou o tipo de recurso para ampliar a consulta.</p></div>
        ) : (
          <div className="table-scroll"><table className="workspace-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Recurso</th>
                <th>Evento</th>
                <th>Autor</th>
                <th>Detalhe</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => {
                const href = resourceHref(event.resourceType, event.resourceId, event.eventType, event.metadata);
                return (
                  <tr key={event.id}>
                    <td>{new Date(event.createdAt).toLocaleString("pt-BR")}</td>
                    <td>
                      {href ? (
                        <Link href={href}>{RESOURCE_LABEL[event.resourceType] ?? event.resourceType}</Link>
                      ) : (
                        RESOURCE_LABEL[event.resourceType] ?? event.resourceType
                      )}
                    </td>
                    <td>{EVENT_TYPE_LABEL[event.eventType] ?? event.eventType}</td>
                    <td>{event.actorName}</td>
                    <td>{event.summary}</td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        )}
      </div>
    </main>
  );
}
