"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { PAGE_ACTIONS_SLOT_ID } from "./page-actions-slot";

/**
 * Só existe pra empurrar conteúdo (via portal) pro slot que o AppShell
 * renderiza ao lado do seletor de mês global — o slot em si vive fora da
 * árvore da página (na casca), então não dá pra simplesmente renderizar ali
 * sem sair do fluxo normal de children.
 */
export function PortalToPageActions({ children }: { children: ReactNode }) {
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setContainer(document.getElementById(PAGE_ACTIONS_SLOT_ID));
  }, []);

  if (!container) return null;
  return createPortal(children, container);
}
