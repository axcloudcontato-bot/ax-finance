import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowUpRight, LogOut, ShieldCheck, WalletCards } from "lucide-react";
import { getPlatformAdminAccess } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { loginPathFor } from "@/lib/auth-return";
import { AdminNav } from "@/components/admin/admin-nav";
import { logoutAction } from "../../(app)/actions";

const ROLE_LABELS: Record<string, string> = { SUPER_ADMIN: "Super administrador", OPERATIONS: "Operações", SUPPORT: "Suporte", ANALYST: "Analista" };

export default async function InternalAdminLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect(loginPathFor("/admin"));
  const access = await getPlatformAdminAccess(user.id);
  if (!access) redirect("/dashboard");
  const initials = user.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link href="/admin" className="admin-brand">
          <span className="admin-brand-mark"><WalletCards size={22} /></span>
          <span><strong>AX Finance</strong><small>Admin console</small></span>
        </Link>
        <AdminNav />
        <div className="admin-sidebar-footer">
          <div className="admin-profile">
            <span className="admin-avatar">{initials}</span>
            <span className="admin-profile-copy"><strong>{user.name}</strong><small>{ROLE_LABELS[access.role] ?? access.role}</small></span>
          </div>
          <div className="admin-profile-actions">
            <Link href="/dashboard" title="Voltar ao produto" aria-label="Voltar ao produto"><ArrowUpRight size={18} /></Link>
            <form action={logoutAction}><button type="submit" title="Sair" aria-label="Sair"><LogOut size={18} /></button></form>
          </div>
        </div>
      </aside>
      <section className="admin-workspace">
        <header className="admin-topbar">
          <div className="admin-environment"><span className="admin-live-dot" />Ambiente interno</div>
          <div className="admin-topbar-context"><ShieldCheck size={17} />Acesso protegido e auditado</div>
        </header>
        {children}
      </section>
    </div>
  );
}
