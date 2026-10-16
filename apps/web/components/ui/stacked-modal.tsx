"use client";

import { useEffect, useId, useRef, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { ModalHeader } from "./modal-header";
import { useModalPresence } from "./use-modal-presence";

const FOCUSABLE = "a[href], button:not(:disabled), input:not(:disabled):not([type='hidden']), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])";

/**
 * Janela por cima de outra janela (ex.: "+ Nova categoria" dentro do lançamento): fundo escurecido
 * sobre a janela de baixo, mesmo cabeçalho das demais. Vai para o container do app, fora do
 * formulário de baixo (os botões seguem o padrão .ax-model-buttons); Esc e Tab ficam presos nela
 * (captura no window, antes dos ouvintes da janela de baixo) e o foco volta para quem a abriu.
 */
export function StackedModal({
  open,
  onClose,
  originRef,
  title,
  icon,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** Botão que abriu: origem da animação e para onde o foco volta. */
  originRef: RefObject<HTMLButtonElement | null>;
  title: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const mounted = useModalPresence(open, originRef, dialogRef, overlayRef);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    const origin = originRef.current;
    dialog?.querySelector<HTMLElement>("input:not([type='hidden']), select, textarea")?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" && event.key !== "Tab") return;
      event.stopPropagation();
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (!dialog) return;
      const focusable = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((element) => element.getClientRects().length > 0);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (!dialog.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      if (origin?.isConnected) origin.focus();
    };
  }, [open, originRef]);

  if (!mounted) return null;
  return createPortal(
    <div ref={overlayRef} className="modal-overlay modal-overlay-stacked" onClick={(event) => { event.stopPropagation(); onClose(); }}>
      <div
        ref={dialogRef}
        className="modal-dialog stacked-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <ModalHeader title={title} titleId={titleId} icon={icon} onClose={onClose} />
        {children}
      </div>
    </div>,
    originRef.current?.closest(".ax-model-buttons") ?? document.body
  );
}
