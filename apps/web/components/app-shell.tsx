"use client";

import type { ReactNode } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { AppTopbar, type DueSoonTitle } from "@/components/app-topbar";
import { GlobalMonthSelector } from "@/components/global-month-selector";
import { PageActionsSlot } from "@/components/page-actions-slot";
import type { MembershipRole } from "@ax-finance/db";

export function AppShell({
  userName,
  userEmail,
  membershipRole,
  canManageMembers,
  logoutAction,
  dueSoonTitles,
  children,
}: {
  userName: string;
  userEmail: string;
  membershipRole: MembershipRole;
  canManageMembers: boolean;
  logoutAction: () => void | Promise<void>;
  dueSoonTitles: DueSoonTitle[];
  children: ReactNode;
}) {
  return (
    <div className="flex h-svh w-full min-w-0 flex-col bg-background">
      <AppTopbar userName={userName} dueSoonTitles={dueSoonTitles} />

      <div className="flex min-h-0 flex-1">
        <AppSidebar
          userName={userName}
          userEmail={userEmail}
          membershipRole={membershipRole}
          canManageMembers={canManageMembers}
          logoutAction={logoutAction}
        />

        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
          <div className="px-6 pt-4 flex items-center justify-between gap-4">
            <GlobalMonthSelector />
            <PageActionsSlot />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
