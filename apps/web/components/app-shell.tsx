"use client";

import type { ReactNode } from "react";
import { AppSidebar } from "@/components/app-sidebar";

export function AppShell({
  companyName,
  userName,
  userEmail,
  logoutAction,
  children,
}: {
  companyName: string;
  userName: string;
  userEmail: string;
  logoutAction: () => void | Promise<void>;
  children: ReactNode;
}) {
  return (
    <div className="flex h-svh w-full min-w-0 bg-background">
      <AppSidebar companyName={companyName} userName={userName} userEmail={userEmail} logoutAction={logoutAction} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center border-b border-border bg-card px-4">
          <p className="text-sm font-medium text-foreground">{companyName}</p>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
