import Link from "next/link";
import { redirect } from "next/navigation";
import { CompanyAccessDeniedError, PartyNotFoundError, getParty } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { formatCents } from "@/lib/currency";
import { formatDateOnly } from "@/lib/dates";
import { TitleStatusBadge } from "@/components/titles/title-status-badge";
import { deactivatePartyAction } from "../actions";
import { reactivatePartyAction, updatePartyAction } from "../actions";
import { ActionModal } from "@/components/ui/action-modal";

export default async function PessoaDetailPage({
  params,
  searchParams,
}: {
  params: { partyId: string };
  searchParams: { erro?: string; atualizado?: string };
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
        {searchParams.erro ? <p className="error">{searchParams.erro}</p> : null}
        {searchParams.atualizado ? <p className="success-box">Cadastro atualizado.</p> : null}

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

        <div style={{display:"flex",gap:"0.75rem",marginTop:"1rem",flexWrap:"wrap"}}>
        <ActionModal triggerLabel="Editar" title={`Editar pessoa — ${party.name}`}>
          <form action={updatePartyAction.bind(null, party.id)}>
            <label htmlFor="edit-party-name">Nome</label><input id="edit-party-name" name="name" defaultValue={party.name} required maxLength={200}/>
            <label htmlFor="edit-trade-name">Nome fantasia</label><input id="edit-trade-name" name="tradeName" defaultValue={party.tradeName ?? ""} maxLength={200}/>
            <label htmlFor="edit-document">Documento</label><input id="edit-document" name="document" defaultValue={party.document ?? ""} maxLength={30}/>
            <label htmlFor="edit-email">E-mail</label><input id="edit-email" name="email" type="email" defaultValue={party.email ?? ""} maxLength={200}/>
            <label htmlFor="edit-phone">Telefone</label><input id="edit-phone" name="phone" defaultValue={party.phone ?? ""} maxLength={30}/>
            <label htmlFor="edit-address">Endereço</label><input id="edit-address" name="address" defaultValue={party.address ?? ""} maxLength={500}/>
            <label htmlFor="edit-responsible">Responsável</label><input id="edit-responsible" name="responsibleName" defaultValue={party.responsibleName ?? ""} maxLength={200}/>
            <label htmlFor="edit-notes">Observações</label><textarea id="edit-notes" name="notes" defaultValue={party.notes ?? ""} maxLength={2000}/>
            <label><input type="checkbox" name="isClient" value="true" defaultChecked={party.isClient}/> Cliente</label>
            <label><input type="checkbox" name="isSupplier" value="true" defaultChecked={party.isSupplier}/> Fornecedor</label>
            <button type="submit">Salvar alterações</button>
          </form>
        </ActionModal>
        {party.status === "ACTIVE" ? (
          <form action={deactivatePartyAction} style={{ marginTop: "1rem" }}>
            <input type="hidden" name="partyId" value={party.id} />
            <button type="submit" className="secondary">
              Inativar
            </button>
          </form>
        ) : <form action={reactivatePartyAction.bind(null, party.id)} className="inline"><button type="submit" className="secondary">Reativar</button></form>}
        </div>
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
