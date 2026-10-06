"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { useModalFocus } from "./use-modal-focus";

/**
 * Modal de estado local (não observa a query string, ao contrário de
 * `Modal`) — para ações que não são "criar um registro" mas ainda assim não
 * devem ficar expostas por padrão na tela (ex.: "Registrar baixa" num
 * título). `initiallyOpen` deixa o servidor decidir se já deve abrir de
 * cara (ex.: a submissão anterior falhou e o erro precisa aparecer aqui).
 */
export function ActionModal({
  triggerLabel,
  triggerAriaLabel,
  triggerClassName = "button-link",
  title,
  icon,
  initiallyOpen = false,
  children,
}: {
  triggerLabel: ReactNode;
  /** Para gatilho só com ícone: nome acessível e dica do botão. */
  triggerAriaLabel?: string;
  triggerClassName?: string;
  title: string;
  /** Mesma família animada de ícones do sidebar, ex.: <Landmark className="size-5" />. */
  icon?: ReactNode;
  initiallyOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const titleId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalFocus(open, setOpen, triggerRef, dialogRef);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={triggerClassName}
        aria-label={triggerAriaLabel}
        title={triggerAriaLabel}
        style={{ marginTop: 0 }}
        onClick={() => setOpen(true)}
      >
        {triggerLabel}
      </button>

      {open ? (
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div ref={dialogRef} className="modal-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} onClick={(event) => event.stopPropagation()}>
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
