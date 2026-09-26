"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Server Actions redirecionam via navegação client-side (o Next não recarrega
 * a página), então o estado local do modal sobrevive ao redirect — por isso
 * não dá pra confiar só em "defaultOpen" na montagem. Em vez disso, o modal
 * observa a query string: qualquer mudança nela (erro=... na falha,
 * criado=... no sucesso) sinaliza que acabou de rolar uma submissão, e só aí
 * ele decide abrir (erro) ou fechar (sucesso). Fora isso, o toggle manual do
 * usuário (botão/×/overlay/Esc) nunca é sobrescrito.
 */
export function Modal({
  triggerLabel,
  title,
  maxWidth,
  children,
}: {
  triggerLabel: string;
  title: string;
  maxWidth?: string;
  children: ReactNode;
}) {
  const searchParams = useSearchParams();
  const hasError = searchParams.has("erro");
  const paramsKey = searchParams.toString();
  const lastParamsKey = useRef(paramsKey);

  const [open, setOpen] = useState(hasError);

  useEffect(() => {
    if (paramsKey !== lastParamsKey.current) {
      lastParamsKey.current = paramsKey;
      setOpen(hasError);
    }
  }, [paramsKey, hasError]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="button-link"
        style={{ marginTop: 0, border: "none" }}
        onClick={() => setOpen(true)}
      >
        {triggerLabel}
      </button>

      {open ? (
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div
            className="modal-dialog"
            style={maxWidth ? { maxWidth } : undefined}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h1>{title}</h1>
              <button
                type="button"
                className="modal-close"
                aria-label="Fechar"
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </div>
            {children}
          </div>
        </div>
      ) : null}
    </>
  );
}
