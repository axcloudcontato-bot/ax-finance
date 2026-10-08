"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/**
 * Menu suspenso "Gerenciar" das linhas de lista (Editar, Ajustar saldo, Arquivar...).
 * O painel fica sempre montado (só escondido com `visibility`) para que os modais e formulários
 * dos itens continuem funcionando depois que o menu fecha; fecha ao clicar fora, em Esc, ao rolar
 * a página ou ao escolher um item. `defaultOpen` abre já de cara (uma ação falhou e o erro está
 * dentro de um dos itens).
 */
export function RowActionsMenu({ label = "Gerenciar", defaultOpen = false, children }: { label?: string; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  const [position, setPosition] = useState<{ top: number; right: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  function place() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const height = panelRef.current?.offsetHeight ?? 0;
    // sem espaço embaixo (últimas linhas da tela), abre para cima
    const below = rect.bottom + 6;
    const top = below + height > window.innerHeight - 8 && rect.top - 6 - height > 8 ? rect.top - 6 - height : below;
    setPosition({ top, right: Math.max(8, window.innerWidth - rect.right) });
  }

  useEffect(() => {
    if (!open) return;
    place();
    const close = () => setOpen(false);
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (target && rootRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.querySelector(".modal-overlay")) setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  return (
    <div className="row-menu" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="row-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <span>{label}</span>
        <svg className="row-menu-chevron" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
          <path d="M4 6.25 8 10l4-3.75" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div
        id={panelId}
        ref={panelRef}
        role="menu"
        className="row-menu-panel"
        data-open={open ? "true" : "false"}
        style={position ? { top: position.top, right: position.right } : undefined}
        onClick={(event) => {
          // fecha ao escolher um item, mas não ao clicar dentro de um modal já aberto
          if ((event.target as HTMLElement).closest(".modal-overlay")) return;
          if ((event.target as HTMLElement).closest("button")) setOpen(false);
        }}
      >
        {children}
      </div>
    </div>
  );
}
