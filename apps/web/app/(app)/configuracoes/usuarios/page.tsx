import { redirect } from "next/navigation";
import { listCompanyInvitations, listCompanyMembers } from "@ax-finance/domain";
import { requirePrimaryCompany } from "@/lib/company";
import { getCurrentUser } from "@/lib/session";
import { InviteUserForm } from "./invite-user-form";
import { revokeInvitationAction, revokeMemberAction, updateMemberRoleAction } from "./actions";

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Proprietário",
  FINANCE_ADMIN: "Administrador financeiro",
  OPERATOR: "Operador",
  ACCOUNTANT: "Contador",
  VIEWER: "Consulta",
};

export default async function CompanyUsersPage({ searchParams }: { searchParams: { erro?: string; atualizado?: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await requirePrimaryCompany(user.id);

  let members;
  let invitations;
  try {
    [members, invitations] = await Promise.all([
      listCompanyMembers(user.id, company.id),
      listCompanyInvitations(user.id, company.id),
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
              <thead><tr><th>Usuário</th><th>Papel</th><th>Status</th><th></th></tr></thead>
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
        </div>
        <InviteUserForm />
      </div>
    </main>
  );
}
