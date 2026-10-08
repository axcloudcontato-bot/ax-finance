"use client";

import { useState } from "react";

/** Copia um texto (linha digitável, chave PIX, mensagem de cobrança) e confirma no próprio botão. */
export function CopyButton({ text, label = "Copiar", className = "secondary" }: { text: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sem permissão da área de transferência: a pessoa ainda pode selecionar o texto na tela.
      setCopied(false);
    }
  }

  return (
    <button type="button" className={className} onClick={() => void copy()} aria-live="polite">
      {copied ? "Copiado ✓" : label}
    </button>
  );
}
