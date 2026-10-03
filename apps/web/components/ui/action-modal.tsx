"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * Modal de estado local (não observa a query string, ao contrário de
 * `Modal`) — para ações que não são "criar um registro" mas ainda assim não
 * devem ficar expostas por padrão na tela (ex.: "Registrar baixa" num
 * título). `initiallyOpen` deixa o servidor decidir se já deve abrir de
 * cara (ex.: a submissão anterior falhou e o erro precisa aparecer aqui).
 */
export function ActionModal({
  triggerLabel,
  title,
  icon,
  initiallyOpen = false,
  children,
}: {
  triggerLabel: string;
  title: string;
  /** Mesma família animada de ícones do sidebar, ex.: <Landmark className="size-5" />. */
  icon?: ReactNode;
  initiallyOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(initiallyOpen);

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
        style={{ marginTop: 0 }}
        onClick={() => setOpen(true)}
      >
        {triggerLabel}
      </button>

      {open ? (
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div className="modal-dialog" onClick={(event) => event.stopPropagation()}>
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
