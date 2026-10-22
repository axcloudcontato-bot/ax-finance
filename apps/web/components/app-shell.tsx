"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { AppTopbar, type AppNotification } from "@/components/app-topbar";
import { GlobalMonthSelector } from "@/components/global-month-selector";
import { BottomMenu } from "@/components/ui/bottom-menu";
import { NotificationToasts } from "@/components/notification-toasts";
import { QuickCreateModal } from "@/components/quick-create";
import type { WriteBlockNotice } from "@/lib/write-block-notice";

export function AppShell({
  userName,
  companyName,
  canManageMembers,
  isPlatformAdmin,
  planCode,
  canUseCreditCards,
  logoutAction,
  notifications,
  blockNotice = null,
  children,
}: {
  userName: string;
  companyName: string;
  canManageMembers: boolean;
  isPlatformAdmin: boolean;
  planCode: "PERSONAL" | "ESSENTIAL";
  canUseCreditCards: boolean;
  logoutAction: () => void | Promise<void>;
  notifications: AppNotification[];
  /** Aviso discreto de empresa bloqueada para escrita (assinatura), ou null. */
  blockNotice?: WriteBlockNotice | null;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const dashboardOwnsToolbar = pathname === "/dashboard";
  const showsPeriod = new Set([
    "/entradas", "/saidas", "/contas", "/transferencias", "/conciliacao",
    "/auditoria", "/relatorios/fluxo-de-caixa", "/relatorios/dre", "/relatorios/forma-de-pagamento", "/orcamento",
  ]).has(pathname);
  const [navOpen, setNavOpen] = useState(false);
  const closeNav = useCallback(() => setNavOpen(false), []);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const pathnameRef = useRef(pathname);
  useEffect(() => { pathnameRef.current = pathname; }, [pathname]);

  // Menu do celular como diálogo: ao abrir, o foco vai para o primeiro item e o resto da página fica
  // inerte (Tab não escapa); ao fechar sem trocar de página, o foco volta para o botão do menu.
  useEffect(() => {
    if (!navOpen) return;
    const openedAt = pathnameRef.current;
    document.querySelector<HTMLElement>("#app-sidebar-navigation a[href], #app-sidebar-navigation button")?.focus();
    const toggle = toggleRef.current;
    return () => {
      if (pathnameRef.current === openedAt) toggle?.focus();
    };
  }, [navOpen]);

  return (
    <div className="app-shell ax-model-buttons flex h-svh w-full min-w-0 flex-col bg-background">
      {/* Primeiro item do Tab: pula a barra do topo e o menu lateral (WCAG 2.4.1). */}
      <a href="#conteudo" className="skip-link">Pular para o conteúdo</a>
      <AppTopbar
        companyName={companyName}
        leading={
          <button
            ref={toggleRef}
            type="button"
            className="app-nav-toggle md:hidden"
            onClick={() => setNavOpen((open) => !open)}
            aria-label={navOpen ? "Fechar menu de navegação" : "Abrir menu de navegação"}
            aria-expanded={navOpen}
            aria-controls="app-sidebar-navigation"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              {navOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        }
      >
        <div className="contents" inert={navOpen || undefined}>
          <BottomMenu
            placement="top"
            userName={userName}
            canManageMembers={canManageMembers}
            isPlatformAdmin={isPlatformAdmin}
            notifications={notifications}
            logoutAction={logoutAction}
          />
        </div>
      </AppTopbar>

      <div className="flex min-h-0 flex-1">
        <AppSidebar
          planCode={planCode}
          canUseCreditCards={canUseCreditCards}
          logoutAction={logoutAction}
          mobileOpen={navOpen}
          onMobileClose={closeNav}
        />

        <div id="conteudo" tabIndex={-1} inert={navOpen || undefined} className="app-content flex min-w-0 flex-1 flex-col overflow-y-auto">
          {!dashboardOwnsToolbar && showsPeriod ? (
            <div className="app-toolbar flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 pt-4 md:px-6">
              <GlobalMonthSelector />
            </div>
          ) : null}
          {children}
        </div>
      </div>

      <QuickCreateModal />
      <NotificationToasts notifications={notifications} blockNotice={blockNotice} />
    </div>
  );
}
