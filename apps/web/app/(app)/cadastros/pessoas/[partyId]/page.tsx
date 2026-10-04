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
import { SubmitButton } from "@/components/ui/submit-button";

export default async function PessoaDetailPage(
  props: {
    params: Promise<{ partyId: string }>;
    searchParams: Promise<{ erro?: string; atualizado?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
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

  const { party, titles } = result;
  const openTitles = titles.filter((title) => (title.status === "OPEN" || title.status === "PARTIALLY_SETTLED") && title.remainingCents > BigInt(0));
  const totalFor = (type: "RECEIVABLE" | "PAYABLE", overdue = false) => openTitles
    .filter((title) => title.type === type && (!overdue || title.overdue))
    .reduce((sum, title) => sum + title.remainingCents, BigInt(0));
  const overdueCountFor = (type: "RECEIVABLE" | "PAYABLE") => openTitles.filter((title) => title.type === type && title.overdue).length;
  const hasReceivables = party.isClient || titles.some((title) => title.type === "RECEIVABLE");
  const hasPayables = party.isSupplier || titles.some((title) => title.type === "PAYABLE");
  const roles = [party.isClient ? "Cliente" : null, party.isSupplier ? "Fornecedor" : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <main className="wide record-detail">
      <nav className="record-detail-nav" aria-label="Navegação da pessoa"><Link href="/cadastros/pessoas">← Clientes e fornecedores</Link><span>/</span><span>Detalhe do cadastro</span></nav>
      <div className="card">
        <div className="page-header record-detail-header">
          <div className="record-detail-heading"><span className="record-detail-eyebrow">{roles}</span><h1>{party.name}</h1>{party.tradeName ? <p className="subtitle">{party.tradeName}</p> : null}</div>
          <span className={`workspace-status ${party.status === "ACTIVE" ? "is-active" : ""}`}>
            {party.status === "ACTIVE" ? "Ativa" : "Inativa"}
          </span>
        </div>
        {searchParams.erro ? <p className="error">{searchParams.erro}</p> : null}
        {searchParams.atualizado ? <p className="success-box">Cadastro atualizado.</p> : null}

        <div className={`record-detail-metrics ${hasReceivables && hasPayables ? "record-detail-metrics-four" : "record-detail-metrics-two"}`}>
          {hasReceivables ? <><div className="record-detail-metric is-primary"><span>A receber</span><strong>{formatCents(totalFor("RECEIVABLE"))}</strong><small>Saldo aberto de entradas</small></div><div className="record-detail-metric"><span>Recebíveis vencidos</span><strong>{formatCents(totalFor("RECEIVABLE", true))}</strong><small>{overdueCountFor("RECEIVABLE")} {overdueCountFor("RECEIVABLE") === 1 ? "título" : "títulos"}</small></div></> : null}
          {hasPayables ? <><div className="record-detail-metric is-primary"><span>A pagar</span><strong>{formatCents(totalFor("PAYABLE"))}</strong><small>Saldo aberto de saídas</small></div><div className="record-detail-metric"><span>Pagáveis vencidos</span><strong>{formatCents(totalFor("PAYABLE", true))}</strong><small>{overdueCountFor("PAYABLE")} {overdueCountFor("PAYABLE") === 1 ? "título" : "títulos"}</small></div></> : null}
        </div>

        <dl className="record-detail-facts">
          {party.document ? <div><dt>Documento</dt><dd>{party.document}</dd></div> : null}
          {party.email ? <div><dt>E-mail</dt><dd><a href={`mailto:${party.email}`}>{party.email}</a></dd></div> : null}
          {party.phone ? <div><dt>Telefone</dt><dd>{party.phone}</dd></div> : null}
          {party.address ? <div><dt>Endereço</dt><dd>{party.address}</dd></div> : null}
          {party.responsibleName ? <div><dt>Responsável</dt><dd>{party.responsibleName}</dd></div> : null}
          {party.notes ? <div><dt>Observações</dt><dd>{party.notes}</dd></div> : null}
        </dl>

        <div className="record-detail-inline-actions">
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
            <SubmitButton>Salvar alterações</SubmitButton>
          </form>
        </ActionModal>
        {party.status === "ACTIVE" ? (
          <ActionModal triggerLabel="Inativar" title="Inativar cadastro"><p className="subtitle">Este cadastro deixará de aparecer na seleção de novos lançamentos. Os títulos existentes permanecem no histórico.</p><form action={deactivatePartyAction}><input type="hidden" name="partyId" value={party.id}/><SubmitButton className="secondary">Confirmar inativação</SubmitButton></form></ActionModal>
        ) : <form action={reactivatePartyAction.bind(null, party.id)} className="inline"><SubmitButton className="secondary">Reativar</SubmitButton></form>}
        </div>
      </div>

      <div className="card">
        <h2>Títulos vinculados</h2>
        {titles.length === 0 ? (
          <p className="muted">Nenhum título vinculado ainda.</p>
        ) : (
          <table className="workspace-table">
            <thead>
              <tr>
                <th>Descrição</th>
                <th>Tipo</th>
                <th>Vencimento</th>
                <th className="money">Saldo aberto</th>
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
                  <td className="money">{title.status === "CANCELLED" ? "—" : formatCents(title.remainingCents, title.currency)}</td>
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
