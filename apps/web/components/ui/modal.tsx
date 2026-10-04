"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { useModalFocus } from "./use-modal-focus";

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
  openWhen,
  children,
}: {
  triggerLabel: ReactNode;
  /** Substitui o "button-link" padrão do gatilho — ex.: os cards de lançamento rápido do dashboard. */
  triggerClassName?: string;
  title: string;
  /** Mesma família animada de ícones do sidebar, ex.: <ArrowDownCircle className="size-5" />. */
  icon?: ReactNode;
  maxWidth?: string;
  /** Abre o modal quando este parâmetro existe na URL, permitindo atalhos globais. */
  openWhen?: string;
  children: ReactNode;
}) {
  const searchParams = useSearchParams();
  const shouldReopen = searchParams.has("erro") || searchParams.has("continuar") || Boolean(openWhen && searchParams.has(openWhen));
  const paramsKey = searchParams.toString();
  const lastParamsKey = useRef(paramsKey);

  const [open, setOpen] = useState(shouldReopen);
  const titleId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalFocus(open, setOpen, triggerRef, dialogRef);

  useEffect(() => {
    if (paramsKey !== lastParamsKey.current) {
      lastParamsKey.current = paramsKey;
      setOpen(shouldReopen);
    }
  }, [paramsKey, shouldReopen]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={triggerClassName ?? "button-link"}
        style={triggerClassName ? undefined : { marginTop: 0 }}
        onClick={() => setOpen(true)}
      >
        {triggerLabel}
      </button>

      {open ? (
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div
            ref={dialogRef}
            className="modal-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            style={maxWidth ? { maxWidth } : undefined}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                {icon}
                <h2 id={titleId}>{title}</h2>
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
