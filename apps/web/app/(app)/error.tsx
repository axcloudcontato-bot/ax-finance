"use client";

import Link from "next/link";

/**
 * Falha ao montar uma tela dentro do app (o menu e o topo continuam no ar). Em produção o Next
 * esconde a mensagem técnica e entrega só o `digest`, que o servidor também grava no log
 * (`web.unhandled_error`): é o código que o usuário passa ao suporte.
 */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="wide">
      <div className="card">
        <div className="workspace-empty">
          <strong>Não foi possível abrir esta tela</strong>
          <p>
            Houve uma falha do nosso lado. Tente de novo; se continuar, informe ao suporte
            {error.digest ? <> o código <code>{error.digest}</code></> : " o que você estava fazendo"}.
          </p>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center" }}>
            <button type="button" className="button-link workspace-primary-action" onClick={() => reset()}>Tentar de novo</button>
            <Link href="/dashboard" className="button-link">Ir para o dashboard</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
