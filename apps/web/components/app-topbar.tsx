import { Wallet } from "@/components/ui/animated-icons";

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  href: string;
  readAt: string | Date | null;
  createdAt: string | Date;
}

// Busca, notificações, perfil e tema ficam no BottomMenu; o topo só leva a marca.
export function AppTopbar() {
  return (
    <header
      className="flex h-16 w-full shrink-0 items-center px-5 text-white"
      style={{ background: "var(--grad-blue)" }}
    >
      <div className="flex items-center gap-2">
        <div className="grid size-8 shrink-0 place-items-center rounded-[6px] bg-white/20">
          <Wallet className="size-4" />
        </div>
        <span className="hidden text-base font-semibold sm:inline">AX Finance</span>
      </div>
    </header>
  );
}
