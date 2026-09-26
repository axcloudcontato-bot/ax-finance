import Link from "next/link";
import { redirect } from "next/navigation";
import { CompanyAccessDeniedError, PartyNotFoundError, getParty } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { formatCents } from "@/lib/currency";
import { formatDateOnly } from "@/lib/dates";
import { TitleStatusBadge } from "@/components/titles/title-status-badge";
import { deactivatePartyAction } from "../actions";

export default async function PessoaDetailPage({
  params,
}: {
  params: { partyId: string };
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const company = await requirePrimaryCompany(user.id);

  let result: Awaited<ReturnType<typeof getParty>>;
  try {
    result = await getParty(user.id, company.id, params.partyId);
  } catch (error) {
    if (error instanceof PartyNotFoundError || error instanceof CompanyAccessDeniedError) {
      redirect("/cadastros/pessoas");
    }
    throw error;
  }

  const { party, titles, openTotalCents, overdueTotalCents, overdueCount } = result;
  const roles = [party.isClient ? "Cliente" : null, party.isSupplier ? "Fornecedor" : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <main className="wide">
      <div className="card">
        <div className="page-header" style={{ marginBottom: "0.5rem" }}>
          <h1>{party.name}</h1>
          <span className="subtitle" style={{ marginBottom: 0 }}>
            {party.status === "ACTIVE" ? "Ativa" : "Inativa"}
          </span>
        </div>
        <p className="subtitle">{roles}</p>

        <table>
          <tbody>
            {party.tradeName ? (
              <tr>
                <td>Nome fantasia</td>
                <td>{party.tradeName}</td>
              </tr>
            ) : null}
            {party.document ? (
              <tr>
                <td>Documento</td>
                <td>{party.document}</td>
              </tr>
            ) : null}
            {party.email ? (
              <tr>
                <td>E-mail</td>
                <td>{party.email}</td>
              </tr>
            ) : null}
            {party.phone ? (
              <tr>
                <td>Telefone</td>
                <td>{party.phone}</td>
              </tr>
            ) : null}
            {party.address ? (
              <tr>
                <td>Endereço</td>
                <td>{party.address}</td>
              </tr>
            ) : null}
            {party.responsibleName ? (
              <tr>
                <td>Responsável</td>
                <td>{party.responsibleName}</td>
              </tr>
            ) : null}
            {party.notes ? (
              <tr>
                <td>Observações</td>
                <td>{party.notes}</td>
              </tr>
            ) : null}
          </tbody>
        </table>

        {party.status === "ACTIVE" ? (
          <form action={deactivatePartyAction} style={{ marginTop: "1rem" }}>
            <input type="hidden" name="partyId" value={party.id} />
            <button type="submit" className="secondary">
              Inativar
            </button>
          </form>
        ) : null}
      </div>

      <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
        <div className="card" style={{ flex: "1 1 200px" }}>
          <h1>Saldo aberto</h1>
          <p style={{ fontSize: "1.5rem", fontWeight: 700 }}>{formatCents(openTotalCents)}</p>
        </div>
        <div className="card" style={{ flex: "1 1 200px" }}>
          <h1>Vencidos</h1>
          <p className="subtitle">
            {overdueCount > 0 ? `${overdueCount} título(s)` : "Nada vencido"}
          </p>
          <p style={{ fontSize: "1.5rem", fontWeight: 700 }}>{formatCents(overdueTotalCents)}</p>
        </div>
      </div>

      <div className="card">
        <h1>Títulos</h1>
        {titles.length === 0 ? (
          <p className="muted">Nenhum título vinculado ainda.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Descrição</th>
                <th>Tipo</th>
                <th>Vencimento</th>
                <th>Saldo aberto</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {titles.map((title) => (
                <tr key={title.id}>
                  <td>
                    <Link href={`/${title.type === "RECEIVABLE" ? "entradas" : "saidas"}/${title.id}`}>
                      {title.description}
                    </Link>
                  </td>
                  <td>{title.type === "RECEIVABLE" ? "Entrada" : "Saída"}</td>
                  <td>{formatDateOnly(title.dueDate)}</td>
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
