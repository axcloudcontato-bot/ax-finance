"use client";

import Link from "next/link";

/** Falha numa página pública ou fora do app (login, cadastro, site). Mesma lógica de código para o suporte. */
export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="narrow" style={{ paddingBlock: "4rem", textAlign: "center" }}>
      <h1>Algo deu errado</h1>
      <p>
        Não foi possível carregar esta página. Tente de novo; se continuar, escreva para o suporte
        {error.digest ? <> informando o código <code>{error.digest}</code></> : null}.
      </p>
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center" }}>
        <button type="button" className="button-link workspace-primary-action" onClick={() => reset()}>Tentar de novo</button>
        <Link href="/" className="button-link">Voltar ao início</Link>
      </div>
    </main>
  );
}
