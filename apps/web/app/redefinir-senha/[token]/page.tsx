import Link from "next/link";
import { resetPasswordAction } from "./actions";

export default function ResetPasswordPage({ params, searchParams }: { params: { token: string }; searchParams: { erro?: string } }) {
  return (
    <main className="narrow">
      <div className="card">
        <h1>Definir nova senha</h1>
        <p className="subtitle">Use pelo menos 8 caracteres. Todas as sessões anteriores serão encerradas.</p>
        {searchParams.erro ? <p className="error">{searchParams.erro}</p> : null}
        <form action={resetPasswordAction.bind(null, params.token)}>
          <label htmlFor="password">Nova senha</label>
          <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} maxLength={200} required />
          <label htmlFor="passwordConfirmation">Confirmar nova senha</label>
          <input id="passwordConfirmation" name="passwordConfirmation" type="password" autoComplete="new-password" minLength={8} maxLength={200} required />
          <button type="submit">Redefinir senha</button>
        </form>
      </div>
      <p className="muted"><Link href="/login">Voltar para o login</Link></p>
    </main>
  );
}
