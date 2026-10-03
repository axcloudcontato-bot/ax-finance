import type { ReactNode } from "react";
import { Wallet } from "@/components/ui/animated-icons";

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  href: string;
  readAt: string | Date | null;
  createdAt: string | Date;
}

// Marca à esquerda e, à direita, o menu de ações (criar, buscar, notificações, perfil e tema).
export function AppTopbar({ leading, children }: { leading?: ReactNode; children?: ReactNode }) {
  return (
    <header
      className="app-topbar relative z-40 flex h-16 w-full shrink-0 items-center justify-between gap-2 px-3 text-white sm:px-5"
    >
      <div className="flex min-w-0 items-center gap-2">
        {leading}
        <div className="grid size-8 shrink-0 place-items-center rounded-[6px] bg-white/20">
          <Wallet className="size-4" />
        </div>
        <span className="hidden text-base font-semibold sm:inline">AX Finance</span>
      </div>
      {children}
    </header>
  );
}
