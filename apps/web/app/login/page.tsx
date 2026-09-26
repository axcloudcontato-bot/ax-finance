import Link from "next/link";
import { loginAction } from "./actions";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { erro?: string; cadastrado?: string };
}) {
  return (
    <main className="narrow">
      <div className="card">
        <h1>Entrar</h1>
        <p className="subtitle">AX Finance — controle financeiro para empresas de serviços.</p>

        {searchParams.cadastrado && (
          <p className="muted">Cadastro concluído. Faça login para continuar.</p>
        )}
        {searchParams.erro && <p className="error">{searchParams.erro}</p>}

        <form action={loginAction}>
          <label htmlFor="email">E-mail</label>
          <input id="email" name="email" type="email" required />

          <label htmlFor="password">Senha</label>
          <input id="password" name="password" type="password" required />

          <button type="submit">Entrar</button>
        </form>
      </div>

      <p className="muted">
        Ainda não tem conta? <Link href="/registro">Criar conta</Link>
      </p>
    </main>
  );
}
