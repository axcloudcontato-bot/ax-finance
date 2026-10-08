import { redirect } from "next/navigation";
import { listCostCenters } from "@ax-finance/domain";
import { requirePrimaryCompany } from "@/lib/company";
import { getCurrentUser } from "@/lib/session";
import { archiveCostCenterAction, createCostCenterAction } from "./actions";
import { reactivateCostCenterAction, updateCostCenterAction } from "./actions";
import { ActionModal } from "@/components/ui/action-modal";
import { RowActionsMenu } from "@/components/ui/row-actions-menu";
import { SubmitButton } from "@/components/ui/submit-button";

export default async function CostCentersPage(
  props: { searchParams: Promise<{ erro?: string; criado?: string; arquivado?: string; atualizado?: string; busca?: string }> }
) {
  const searchParams = await props.searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await requirePrimaryCompany(user.id);
  const costCenters = await listCostCenters(user.id, company.id, true);
  const search = (searchParams.busca ?? "").trim().slice(0, 100);
  const searchable = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
  const query = searchable(search);
  const visibleCenters = query ? costCenters.filter((center) => searchable(`${center.name} ${center.code ?? ""}`).includes(query)) : costCenters;

  return <main className="wide">
    <div className="page-header"><div><h1>Centros de custo</h1><p className="subtitle">Classifique títulos e limite o acesso dos usuários por área.</p></div></div>
    {searchParams.erro ? <p className="error">{searchParams.erro}</p> : null}
    {searchParams.criado ? <p className="success-box">Centro de custo criado.</p> : null}
    {searchParams.arquivado ? <p className="success-box">Centro de custo arquivado.</p> : null}
    {searchParams.atualizado ? <p className="success-box">Centro de custo atualizado.</p> : null}
    <div className="split">
      <div className="card">
        <h2>Centros cadastrados</h2>
        <div className="workspace-list-toolbar"><p>{visibleCenters.length} {visibleCenters.length === 1 ? "centro exibido" : "centros exibidos"}</p><form method="get" action="/cadastros/centros-de-custo"><input name="busca" type="search" defaultValue={search} placeholder="Nome ou código" aria-label="Buscar centro de custo" /><button type="submit" className="secondary">Buscar</button>{search ? <a href="/cadastros/centros-de-custo">Limpar</a> : null}</form></div>
        {visibleCenters.length === 0 ? <div className="workspace-empty"><strong>{search ? "Nenhum centro encontrado" : "Nenhum centro de custo cadastrado"}</strong><p>{search ? "Tente outro termo ou limpe a busca." : "Use o formulário ao lado para classificar gastos por área."}</p></div> : <div className="table-scroll"><table className="workspace-table">
          <thead><tr><th>Nome</th><th>Código</th><th>Status</th><th><span className="sr-only">Ações</span></th></tr></thead>
          <tbody>{visibleCenters.map((center) => <tr key={center.id}>
            <td>{center.name}</td><td>{center.code || "—"}</td><td><span className={`workspace-status ${center.status === "ACTIVE" ? "is-active" : ""}`}>{center.status === "ACTIVE" ? "Ativo" : "Arquivado"}</span></td>
            <td><RowActionsMenu>
              <ActionModal triggerLabel="Editar" title={`Editar centro — ${center.name}`}><form action={updateCostCenterAction.bind(null, center.id)}><label htmlFor={`center-name-${center.id}`}>Nome</label><input id={`center-name-${center.id}`} name="name" defaultValue={center.name} required maxLength={200}/><label htmlFor={`center-code-${center.id}`}>Código</label><input id={`center-code-${center.id}`} name="code" defaultValue={center.code ?? ""} maxLength={50}/><SubmitButton>Salvar alterações</SubmitButton></form></ActionModal>
              {center.status === "ACTIVE" ? <form action={archiveCostCenterAction.bind(null, center.id)} className="inline"><SubmitButton className="secondary">Arquivar</SubmitButton></form> : <form action={reactivateCostCenterAction.bind(null, center.id)} className="inline"><SubmitButton className="secondary">Reativar</SubmitButton></form>}
            </RowActionsMenu></td>
          </tr>)}</tbody>
        </table></div>}
      </div>
      <div className="card">
        <h2>Novo centro de custo</h2>
        <form action={createCostCenterAction}>
          <label htmlFor="cost-center-name">Nome</label>
          <input id="cost-center-name" name="name" required maxLength={200} />
          <label htmlFor="cost-center-code">Código (opcional)</label>
          <input id="cost-center-code" name="code" maxLength={50} />
          <SubmitButton>Criar centro de custo</SubmitButton>
        </form>
      </div>
    </div>
  </main>;
}
