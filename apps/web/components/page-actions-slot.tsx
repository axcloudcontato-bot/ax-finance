"use client";

export const PAGE_ACTIONS_SLOT_ID = "page-actions-slot";

/**
 * Fica na mesma linha do seletor de mês global (AppShell) — páginas que
 * precisam de um botão de ação ali (ex.: os cards de lançamento rápido do
 * dashboard) usam <PortalToPageActions> pra renderizar dentro deste div via
 * portal, em vez de duplicar esse pedaço da casca em cada página.
 */
export function PageActionsSlot({ className }: { className?: string }) {
  return <div id={PAGE_ACTIONS_SLOT_ID} className={className} />;
}
