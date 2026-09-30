import Link from "next/link";
import { registerAction } from "./actions";

export default async function RegistroPage(
  props: {
    searchParams: Promise<{ erro?: string; retorno?: string; plano?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const selectedPlan = searchParams.plano?.toUpperCase() === "PERSONAL" ? "PERSONAL" : "ESSENTIAL";
  return (
    <main className="narrow">
      <div className="card">
        <h1>Criar conta</h1>
        <p className="subtitle">Comece com o plano {selectedPlan === "PERSONAL" ? "Gestão Pessoal por R$ 29,90/mês" : "Essencial por R$ 59/mês"}.</p>

        {searchParams.erro && <p className="error">{searchParams.erro}</p>}

        <form action={registerAction}>
          {searchParams.retorno ? <input type="hidden" name="returnTo" value={searchParams.retorno} /> : null}
          <input type="hidden" name="planCode" value={selectedPlan} />
          <label htmlFor="name">Nome</label>
          <input id="name" name="name" type="text" required maxLength={200} />

          <label htmlFor="email">E-mail</label>
          <input id="email" name="email" type="email" required />

          <label htmlFor="password">Senha</label>
          <input id="password" name="password" type="password" required minLength={8} />

          <button type="submit">Criar conta</button>
        </form>
      </div>

      <p className="muted">
        Já tem conta? <Link href="/login">Entrar</Link>
      </p>
    </main>
  );
}
