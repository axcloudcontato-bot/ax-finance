import Link from "next/link";
import { registerAction } from "./actions";

export default function RegistroPage({
  searchParams,
}: {
  searchParams: { erro?: string };
}) {
  return (
    <main className="narrow">
      <div className="card">
        <h1>Criar conta</h1>
        <p className="subtitle">Comece a organizar o financeiro da sua empresa.</p>

        {searchParams.erro && <p className="error">{searchParams.erro}</p>}

        <form action={registerAction}>
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
