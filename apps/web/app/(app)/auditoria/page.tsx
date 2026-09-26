import Link from "next/link";
import { redirect } from "next/navigation";
import { EVENT_TYPE_LABEL, listAuditEvents } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { currentYearMonth, monthRange } from "@/lib/month";

const RESOURCE_LABEL: Record<string, string> = {
  Title: "Título",
  Transfer: "Transferência",
  Period: "Período",
  InstallmentGroup: "Parcelamento",
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

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: { tipo?: string; mes?: string };
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const company = await requirePrimaryCompany(user.id);

  const month = searchParams.mes ?? currentYearMonth();
  const { from, to } = monthRange(month);
  const resourceType = searchParams.tipo || undefined;

  const events = await listAuditEvents(user.id, company.id, { resourceType, from, to });

  const filterHref = (tipo?: string) => {
    const params = new URLSearchParams();
    if (tipo) params.set("tipo", tipo);
    if (month !== currentYearMonth()) params.set("mes", month);
    const query = params.toString();
    return query ? `/auditoria?${query}` : "/auditoria";
  };

  return (
    <main className="wide">
      <h1 style={{ marginBottom: "1rem" }}>Auditoria</h1>

      <div className="filters">
        <a href={filterHref(undefined)} className={!resourceType ? "active" : ""}>
          Todos
        </a>
        <a href={filterHref("Title")} className={resourceType === "Title" ? "active" : ""}>
          Títulos
        </a>
        <a href={filterHref("Transfer")} className={resourceType === "Transfer" ? "active" : ""}>
          Transferências
        </a>
      </div>

      <div className="card">
        {events.length === 0 ? (
          <p className="muted">Nenhum evento nesse período/filtro.</p>
        ) : (
          <table>
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
          </table>
        )}
      </div>
    </main>
  );
}
