import Link from "next/link";
import { getCompanyInvitationByToken } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { acceptInvitationAction } from "./actions";

const ROLE_LABEL: Record<string, string> = {
  FINANCE_ADMIN: "Administrador financeiro",
  OPERATOR: "Operador",
  ACCOUNTANT: "Contador",
  VIEWER: "Consulta",
};

export default async function InvitationPage(
  props: { params: Promise<{ token: string }>; searchParams: Promise<{ erro?: string }> }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const user = await getCurrentUser();
  const returnTo = `/convites/${params.token}`;

  if (!user) {
    return (
      <main className="narrow">
        <div className="card">
          <h1>Você recebeu um convite</h1>
          <p className="subtitle">Entre com o e-mail que recebeu o convite para visualizar e aceitar o acesso.</p>
          <div className="invitation-actions">
            <Link className="button-link" href={`/login?retorno=${encodeURIComponent(returnTo)}`}>Entrar para aceitar</Link>
            <Link href={`/registro?retorno=${encodeURIComponent(returnTo)}`}>Criar conta</Link>
          </div>
        </div>
      </main>
    );
  }

  let invitation;
  try {
    invitation = await getCompanyInvitationByToken(user.id, params.token);
  } catch {
    return <main className="narrow"><div className="card"><h1>Convite indisponível</h1><p className="subtitle">Este convite é inválido, expirou ou já foi utilizado.</p><Link className="button-link" href="/login">Ir para o login</Link></div></main>;
  }

  return (
    <main className="narrow">
      <div className="card">
        <h1>Convite para {invitation.companyName}</h1>
        <p className="subtitle">Você foi convidado como <strong>{ROLE_LABEL[invitation.role]}</strong>.</p>
        <p>Este convite pertence a <strong>{invitation.email}</strong> e expira em {invitation.expiresAt.toLocaleDateString("pt-BR")}.</p>
        {searchParams.erro ? <p className="error">{searchParams.erro}</p> : null}
        <form action={acceptInvitationAction.bind(null, params.token)}><button type="submit">Aceitar convite</button></form>
      </div>
    </main>
  );
}
