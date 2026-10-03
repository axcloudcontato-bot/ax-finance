import { redirect } from "next/navigation";
import { listCostCenters } from "@ax-finance/domain";
import { requirePrimaryCompany } from "@/lib/company";
import { getCurrentUser } from "@/lib/session";
import { archiveCostCenterAction, createCostCenterAction } from "./actions";
import { reactivateCostCenterAction, updateCostCenterAction } from "./actions";
import { ActionModal } from "@/components/ui/action-modal";
import { SubmitButton } from "@/components/ui/submit-button";

export default async function CostCentersPage(
  props: { searchParams: Promise<{ erro?: string; criado?: string; arquivado?: string; atualizado?: string }> }
) {
  const searchParams = await props.searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await requirePrimaryCompany(user.id);
  const costCenters = await listCostCenters(user.id, company.id, true);

  return <main className="wide">
    <div className="page-header"><div><h1>Centros de custo</h1><p className="subtitle">Classifique títulos e limite o acesso dos usuários por área.</p></div></div>
    {searchParams.erro ? <p className="error">{searchParams.erro}</p> : null}
    {searchParams.criado ? <p className="success-box">Centro de custo criado.</p> : null}
    {searchParams.arquivado ? <p className="success-box">Centro de custo arquivado.</p> : null}
    {searchParams.atualizado ? <p className="success-box">Centro de custo atualizado.</p> : null}
    <div className="split">
      <div className="card">
        <h1>Centros cadastrados</h1>
        {costCenters.length === 0 ? <p className="muted">Nenhum centro de custo cadastrado.</p> : <table>
          <thead><tr><th>Nome</th><th>Código</th><th>Status</th><th></th></tr></thead>
          <tbody>{costCenters.map((center) => <tr key={center.id}>
            <td>{center.name}</td><td>{center.code || "—"}</td><td>{center.status === "ACTIVE" ? "Ativo" : "Arquivado"}</td>
            <td><div style={{display:"flex",gap:"0.5rem",flexWrap:"wrap"}}>
              <ActionModal triggerLabel="Editar" title={`Editar centro — ${center.name}`}><form action={updateCostCenterAction.bind(null, center.id)}><label htmlFor={`center-name-${center.id}`}>Nome</label><input id={`center-name-${center.id}`} name="name" defaultValue={center.name} required maxLength={200}/><label htmlFor={`center-code-${center.id}`}>Código</label><input id={`center-code-${center.id}`} name="code" defaultValue={center.code ?? ""} maxLength={50}/><SubmitButton>Salvar alterações</SubmitButton></form></ActionModal>
              {center.status === "ACTIVE" ? <form action={archiveCostCenterAction.bind(null, center.id)} className="inline"><SubmitButton className="secondary">Arquivar</SubmitButton></form> : <form action={reactivateCostCenterAction.bind(null, center.id)} className="inline"><SubmitButton className="secondary">Reativar</SubmitButton></form>}
            </div></td>
          </tr>)}</tbody>
        </table>}
      </div>
      <div className="card">
        <h1>Novo centro de custo</h1>
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
