import { redirect } from "next/navigation";
import { listCompanyInvitations, listCompanyMembers, listCostCenters, listFinancialAccounts } from "@ax-finance/domain";
import { requirePrimaryCompany } from "@/lib/company";
import { getCurrentUser } from "@/lib/session";
import { InviteUserForm } from "./invite-user-form";
import { revokeInvitationAction, revokeMemberAction, transferOwnershipAction, updateMemberAccessAction, updateMemberRoleAction } from "./actions";

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Proprietário",
  FINANCE_ADMIN: "Administrador financeiro",
  OPERATOR: "Operador",
  ACCOUNTANT: "Contador",
  VIEWER: "Consulta",
};

export default async function CompanyUsersPage(props: { searchParams: Promise<{ erro?: string; atualizado?: string }> }) {
  const searchParams = await props.searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await requirePrimaryCompany(user.id);

  let members;
  let invitations;
  let accounts;
  let costCenters;
  try {
    [members, invitations, accounts, costCenters] = await Promise.all([
      listCompanyMembers(user.id, company.id),
      listCompanyInvitations(user.id, company.id),
      listFinancialAccounts(user.id, company.id, true),
      listCostCenters(user.id, company.id),
    ]);
  } catch {
    redirect("/dashboard");
  }

  return (
    <main className="wide">
      <div className="page-header">
        <div><h1>Usuários e acessos</h1><p className="subtitle">Gerencie quem pode acessar {company.name}.</p></div>
      </div>
      {searchParams.erro ? <p className="error">{searchParams.erro}</p> : null}
      {searchParams.atualizado ? <p className="success-box">Acesso atualizado com sucesso.</p> : null}

      <div className="split">
        <div>
          <div className="card">
            <h1>Usuários</h1>
            <table>
              <thead><tr><th>Usuário</th><th>Papel</th><th>Escopo</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {members.map((membership) => (
                  <tr key={membership.id}>
                    <td><strong>{membership.user.name}</strong><br /><span className="muted">{membership.user.email}</span></td>
                    <td>
                      {membership.role === "OWNER" ? ROLE_LABEL.OWNER : (
                        <form action={updateMemberRoleAction.bind(null, membership.id)} className="inline-action-form">
                          <select name="role" defaultValue={membership.role} aria-label={`Papel de ${membership.user.name}`}>
                            <option value="FINANCE_ADMIN">Administrador financeiro</option>
                            <option value="OPERATOR">Operador</option>
                            <option value="ACCOUNTANT">Contador</option>
                            <option value="VIEWER">Consulta</option>
                          </select>
                          <button type="submit" className="secondary">Salvar</button>
                        </form>
                      )}
                    </td>
                    <td>
                      {membership.role === "OWNER" ? "Acesso total" : membership.status !== "ACTIVE" ? "—" : (
                        <details>
                          <summary>{membership.accessScope === "ALL" ? "Acesso total" : "Restrito"}</summary>
                          <form action={updateMemberAccessAction.bind(null, membership.id)} className="access-scope-form">
                            <label><input type="radio" name="accessScope" value="ALL" defaultChecked={membership.accessScope === "ALL"} /> Todas as contas e centros de custo</label>
                            <label><input type="radio" name="accessScope" value="RESTRICTED" defaultChecked={membership.accessScope === "RESTRICTED"} /> Somente os itens selecionados</label>
                            <fieldset>
                              <legend>Contas</legend>
                              {accounts.map((account) => <label key={account.id}><input type="checkbox" name="financialAccountIds" value={account.id} defaultChecked={membership.accountAccess.some((item) => item.financialAccountId === account.id)} /> {account.name}</label>)}
                            </fieldset>
                            <fieldset>
                              <legend>Centros de custo</legend>
                              {costCenters.length === 0 ? <span className="muted">Nenhum centro cadastrado.</span> : costCenters.map((center) => <label key={center.id}><input type="checkbox" name="costCenterIds" value={center.id} defaultChecked={membership.costCenterAccess.some((item) => item.costCenterId === center.id)} /> {center.name}</label>)}
                            </fieldset>
                            <button type="submit" className="secondary">Salvar escopo</button>
                          </form>
                        </details>
                      )}
                    </td>
                    <td>{membership.status === "ACTIVE" ? "Ativo" : "Revogado"}</td>
                    <td>{membership.role !== "OWNER" && membership.status === "ACTIVE" ? (
                      <form action={revokeMemberAction.bind(null, membership.id)} className="inline">
                        <button type="submit" className="danger-button">Revogar</button>
                      </form>
                    ) : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card">
            <h1>Convites</h1>
            {invitations.length === 0 ? <p className="muted">Nenhum convite criado.</p> : (
              <table>
                <thead><tr><th>E-mail</th><th>Papel</th><th>Status</th><th>Expira em</th><th></th></tr></thead>
                <tbody>{invitations.map((invitation) => {
                  const expired = invitation.status === "PENDING" && invitation.expiresAt <= new Date();
                  return <tr key={invitation.id}>
                    <td>{invitation.email}</td><td>{ROLE_LABEL[invitation.role]}</td>
                    <td>{expired ? "Expirado" : invitation.status === "PENDING" ? "Pendente" : invitation.status === "ACCEPTED" ? "Aceito" : "Revogado"}</td>
                    <td>{invitation.expiresAt.toLocaleDateString("pt-BR")}</td>
                    <td>{invitation.status === "PENDING" && !expired ? <form action={revokeInvitationAction.bind(null, invitation.id)} className="inline"><button type="submit" className="danger-button">Revogar</button></form> : null}</td>
                  </tr>;
                })}</tbody>
              </table>
            )}
          </div>

          <div className="card">
            <h1>Transferir propriedade</h1>
            <p className="subtitle">O novo proprietário terá acesso total. Seu papel passará para Administrador financeiro.</p>
            <form action={transferOwnershipAction}>
              <label htmlFor="new-owner">Novo proprietário</label>
              <select id="new-owner" name="membershipId" required defaultValue="">
                <option value="" disabled>Selecione um usuário ativo</option>
                {members.filter((membership) => membership.role !== "OWNER" && membership.status === "ACTIVE").map((membership) => (
                  <option key={membership.id} value={membership.id}>{membership.user.name} — {membership.user.email}</option>
                ))}
              </select>
              <label htmlFor="ownership-confirmation">Digite TRANSFERIR para confirmar</label>
              <input id="ownership-confirmation" name="confirmation" required pattern="TRANSFERIR" autoComplete="off" />
              <button type="submit" className="danger-button">Transferir propriedade</button>
            </form>
          </div>
        </div>
        <InviteUserForm />
      </div>
    </main>
  );
}
