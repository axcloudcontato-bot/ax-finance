"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { AppTopbar, type AppNotification } from "@/components/app-topbar";
import { GlobalMonthSelector } from "@/components/global-month-selector";
import { PageActionsSlot } from "@/components/page-actions-slot";
import { BottomMenu } from "@/components/ui/bottom-menu";
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
  children: ReactNode;
}) {
  const pathname = usePathname();
  const dashboardOwnsToolbar = pathname === "/dashboard";

  return (
    <div className="ax-model-buttons flex h-svh w-full min-w-0 flex-col bg-background">
      <AppTopbar>
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
        />

        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
          {!dashboardOwnsToolbar ? (
            <div className="flex items-center justify-between gap-4 px-6 pt-4">
              <GlobalMonthSelector />
              <PageActionsSlot />
            </div>
          ) : null}
          {children}
        </div>
      </div>
    </div>
  );
}
