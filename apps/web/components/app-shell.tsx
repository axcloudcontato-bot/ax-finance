"use client";

import { useCallback, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { AppTopbar, type AppNotification } from "@/components/app-topbar";
import { GlobalMonthSelector } from "@/components/global-month-selector";
import { BottomMenu } from "@/components/ui/bottom-menu";
import { NotificationToasts } from "@/components/notification-toasts";
import type { WriteBlockNotice } from "@/lib/write-block-notice";
import type { MembershipRole } from "@ax-finance/db";

export function AppShell({
  userName,
  userEmail,
  membershipRole,
  canManageMembers,
  isPlatformAdmin,
  planCode,
  logoutAction,
  notifications,
  blockNotice = null,
  children,
}: {
  userName: string;
  userEmail: string;
  membershipRole: MembershipRole;
  canManageMembers: boolean;
  isPlatformAdmin: boolean;
  planCode: "PERSONAL" | "ESSENTIAL";
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
    "/auditoria", "/relatorios/fluxo-de-caixa", "/relatorios/dre",
  ]).has(pathname);
  const [navOpen, setNavOpen] = useState(false);
  const closeNav = useCallback(() => setNavOpen(false), []);

  return (
    <div className="ax-model-buttons flex h-svh w-full min-w-0 flex-col bg-background">
      <AppTopbar
        leading={
          <button
            type="button"
            className="app-nav-toggle md:hidden"
            onClick={() => setNavOpen((open) => !open)}
            aria-label={navOpen ? "Fechar menu de navegação" : "Abrir menu de navegação"}
            aria-expanded={navOpen}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              {navOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        }
      >
        <BottomMenu
          placement="top"
          userName={userName}
          canManageMembers={canManageMembers}
          notifications={notifications}
          logoutAction={logoutAction}
        />
      </AppTopbar>

      <div className="flex min-h-0 flex-1">
        <AppSidebar
          userName={userName}
          userEmail={userEmail}
          membershipRole={membershipRole}
          canManageMembers={canManageMembers}
          isPlatformAdmin={isPlatformAdmin}
          planCode={planCode}
          logoutAction={logoutAction}
          mobileOpen={navOpen}
          onMobileClose={closeNav}
        />

        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
          {!dashboardOwnsToolbar && showsPeriod ? (
            <div className="app-toolbar flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 pt-4 md:px-6">
              <GlobalMonthSelector />
            </div>
          ) : null}
          {children}
        </div>
      </div>

      <NotificationToasts notifications={notifications} blockNotice={blockNotice} />
    </div>
  );
}
