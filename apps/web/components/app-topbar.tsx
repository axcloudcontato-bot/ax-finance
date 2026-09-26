import { Bell, Mail, Search, Wallet } from "lucide-react";
import { initialsOf } from "@/lib/user-display";

export function AppTopbar({ userName }: { userName: string }) {
  return (
    <header
      className="flex h-16 w-full shrink-0 items-center justify-between px-5 text-white"
      style={{ background: "var(--grad-blue)" }}
    >
      <div className="flex items-center gap-2">
        <div className="grid size-8 shrink-0 place-items-center rounded-[6px] bg-white/20">
          <Wallet className="size-4" />
        </div>
        <span className="text-base font-semibold">AX Finance</span>
      </div>

      <div className="flex items-center gap-4">
        <Search className="size-5 opacity-90" aria-hidden />
        <div className="relative">
          <Bell className="size-5 opacity-90" aria-hidden />
          <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-red-400" />
        </div>
        <Mail className="size-5 opacity-90" aria-hidden />
        <span className="grid size-9 place-items-center rounded-full bg-white/20 text-xs font-semibold">
          {initialsOf(userName)}
        </span>
      </div>
    </header>
  );
}
