import Link from "next/link";
import { resendVerificationAction } from "./actions";

export default async function ResendVerificationPage(props: { searchParams: Promise<{ enviado?: string; preview?: string }> }) {
  const searchParams = await props.searchParams;
  return (
    <main className="narrow">
      <div className="card">
        <h1>Confirmar e-mail</h1>
        <p className="subtitle">Informe seu e-mail para receber um novo link de confirmação.</p>
        {searchParams.enviado ? <p className="success-box">Se a conta estiver pendente, um novo link foi enviado.</p> : null}
        {searchParams.preview ? <p className="success-box">Ambiente local: <Link href={searchParams.preview}>abrir link de verificação</Link>.</p> : null}
        <form action={resendVerificationAction}>
          <label htmlFor="email">E-mail</label>
          <input id="email" name="email" type="email" autoComplete="email" required maxLength={254} />
          <button type="submit">Reenviar confirmação</button>
        </form>
      </div>
      <p className="muted"><Link href="/login">Voltar para o login</Link></p>
    </main>
  );
}
