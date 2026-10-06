"use client";

/**
 * Último recurso: falha no próprio layout raiz. Substitui a página inteira, então traz o próprio
 * <html> e estilos mínimos em linha (o CSS global pode não ter carregado).
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f7f8fb", color: "#1b2433" }}>
        <main style={{ maxWidth: 520, margin: "0 auto", padding: "4rem 1.25rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.4rem" }}>Algo deu errado</h1>
          <p style={{ lineHeight: 1.5 }}>
            O AX Finance não conseguiu carregar. Tente de novo; se continuar, escreva para o suporte
            {error.digest ? <> informando o código <code>{error.digest}</code></> : null}.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{ padding: "0.6rem 1.1rem", borderRadius: 8, border: "1px solid #c9d1e0", background: "#fff", cursor: "pointer" }}
          >
            Tentar de novo
          </button>
        </main>
      </body>
    </html>
  );
}
