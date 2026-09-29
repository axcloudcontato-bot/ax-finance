import Link from "next/link";
import { verifyEmailAction } from "./actions";

export default async function VerifyEmailPage(
  props: { params: Promise<{ token: string }>; searchParams: Promise<{ erro?: string; retorno?: string }> }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  return (
    <main className="narrow">
      <div className="card">
        <h1>Confirmar e-mail</h1>
        <p className="subtitle">Confirme este endereço para ativar seu acesso ao AX Finance.</p>
        {searchParams.erro ? <p className="error">{searchParams.erro}</p> : null}
        <form action={verifyEmailAction.bind(null, params.token, searchParams.retorno)}>
          <button type="submit">Confirmar meu e-mail</button>
        </form>
      </div>
      <p className="muted"><Link href="/login">Voltar para o login</Link></p>
    </main>
  );
}
