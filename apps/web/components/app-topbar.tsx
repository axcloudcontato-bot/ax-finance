import type { ReactNode } from "react";
import { OpenfixMark } from "@/components/brand/openfix-logo";

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  href: string;
  /** NotificationType do banco (ex.: TITLE_OVERDUE); define o ícone no cartão de avisos. */
  type?: string;
  readAt: string | Date | null;
  createdAt: string | Date;
}

// Marca à esquerda e, à direita, o menu de ações (criar, buscar, notificações, perfil e tema).
export function AppTopbar({ leading, children, companyName }: { leading?: ReactNode; children?: ReactNode; companyName: string }) {
  return (
    <header
      className="app-topbar relative z-40 flex h-16 w-full shrink-0 items-center justify-between gap-2 px-3 sm:px-5"
    >
      <div className="flex min-w-0 items-center gap-2">
        {leading}
        <OpenfixMark size={30} className="shrink-0" />
        <div className="app-workspace-identity min-w-0">
          <span className="app-workspace-brand openfix-wordmark">openfix</span>
          <span className="app-workspace-name" title={companyName}>{companyName}</span>
        </div>
      </div>
      {children}
    </header>
  );
}
