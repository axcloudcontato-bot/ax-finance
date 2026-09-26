"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Server Actions redirecionam via navegação client-side (o Next não recarrega
 * a página), então o estado local do modal sobrevive ao redirect — por isso
 * não dá pra confiar só em "defaultOpen" na montagem. Em vez disso, o modal
 * observa a query string: qualquer mudança nela sinaliza que acabou de rolar
 * uma submissão, e só aí ele decide abrir de novo (erro=... na falha,
 * continuar=... quando o próprio fluxo pede pra continuar preenchendo, ex.:
 * "Salvar e nova entrada") ou fechar (sucesso comum, ex.: criado=...). Fora
 * isso, o toggle manual do usuário (botão/×/overlay/Esc) nunca é sobrescrito.
 */
export function Modal({
  triggerLabel,
  triggerClassName,
  title,
  icon,
  maxWidth,
  children,
}: {
  triggerLabel: ReactNode;
  /** Substitui o "button-link" padrão do gatilho — ex.: os cards de lançamento rápido do dashboard. */
  triggerClassName?: string;
  title: string;
  /** Mesma família de ícones do sidebar (lucide-react), ex.: <ArrowDownCircle className="size-5" strokeWidth={1.5} />. */
  icon?: ReactNode;
  maxWidth?: string;
  children: ReactNode;
}) {
  const searchParams = useSearchParams();
  const shouldReopen = searchParams.has("erro") || searchParams.has("continuar");
  const paramsKey = searchParams.toString();
  const lastParamsKey = useRef(paramsKey);

  const [open, setOpen] = useState(shouldReopen);

  useEffect(() => {
    if (paramsKey !== lastParamsKey.current) {
      lastParamsKey.current = paramsKey;
      setOpen(shouldReopen);
    }
  }, [paramsKey, shouldReopen]);

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
        className={triggerClassName ?? "button-link"}
        style={triggerClassName ? undefined : { marginTop: 0, border: "none" }}
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
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                {icon}
                <h1>{title}</h1>
              </div>
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
