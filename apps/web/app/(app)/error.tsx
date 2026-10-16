"use client";

import Link from "next/link";

/** Tela aberta antes de um deploy: o formulário chama uma ação que a versão nova não tem mais. */
function isStaleDeployment(error: Error) {
  return /server action|failed-to-find-server-action|ChunkLoadError|Loading chunk/i.test(`${error.name} ${error.message}`);
}

/**
 * Falha ao montar uma tela dentro do app (o menu e o topo continuam no ar). Em produção o Next
 * esconde a mensagem técnica e entrega só o `digest`, que o servidor também grava no log
 * (`web.unhandled_error`): é o código que o usuário passa ao suporte. Se a falha veio de uma
 * versão antiga da tela (houve atualização do sistema com ela aberta), basta recarregar.
 */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const stale = isStaleDeployment(error);
  return (
    <main className="wide">
      <div className="card">
        <div className="workspace-empty app-error">
          <strong>{stale ? "O AX Finance foi atualizado" : "Não foi possível abrir esta tela"}</strong>
          <p>
            {stale
              ? "Esta tela estava aberta desde antes da atualização. Recarregue a página e repita a última ação; o que não foi salvo precisa ser digitado de novo."
              : <>Houve uma falha do nosso lado. Tente de novo; se continuar, informe ao suporte{error.digest ? <> o código <code>{error.digest}</code></> : " o que você estava fazendo"}.</>}
          </p>
          <div className="app-error-actions">
            {stale
              ? <button type="button" className="button-link workspace-primary-action" onClick={() => window.location.reload()}>Recarregar página</button>
              : <button type="button" className="button-link workspace-primary-action" onClick={() => reset()}>Tentar de novo</button>}
            <Link href="/dashboard" className="button-link">Ir para o dashboard</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
