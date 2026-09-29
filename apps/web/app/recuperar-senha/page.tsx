import Link from "next/link";
import { requestPasswordResetAction } from "./actions";

export default async function PasswordRecoveryPage(props: { searchParams: Promise<{ enviado?: string; preview?: string }> }) {
  const searchParams = await props.searchParams;
  return (
    <main className="narrow">
      <div className="card">
        <h1>Recuperar senha</h1>
        <p className="subtitle">Informe o e-mail da sua conta. Se ele estiver cadastrado, enviaremos um link válido por 1 hora.</p>
        {searchParams.enviado ? <p className="success-box">Se o e-mail estiver cadastrado, as instruções foram enviadas.</p> : null}
        {searchParams.preview ? <p className="success-box">Ambiente local: <Link href={searchParams.preview}>abrir link de redefinição</Link>.</p> : null}
        <form action={requestPasswordResetAction}>
          <label htmlFor="email">E-mail</label>
          <input id="email" name="email" type="email" autoComplete="email" required maxLength={254} />
          <button type="submit">Enviar instruções</button>
        </form>
      </div>
      <p className="muted"><Link href="/login">Voltar para o login</Link></p>
    </main>
  );
}
