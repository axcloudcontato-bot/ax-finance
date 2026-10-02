import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowUpRight, LogOut, ShieldCheck, WalletCards } from "@/components/ui/animated-icons";
import { getPlatformAdminAccess } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { loginPathFor } from "@/lib/auth-return";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { logoutAction } from "../../(app)/actions";
import { noIndexMetadata } from "@/lib/site";

export const metadata: Metadata = noIndexMetadata;

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
            <form action={logoutAction}><button type="submit" className="admin-profile-action-button" title="Sair" aria-label="Sair"><LogOut size={18} /></button></form>
          </div>
        </div>
      </aside>
      <section className="admin-workspace">
        <header className="admin-topbar">
          <div className="admin-environment"><span className="admin-live-dot" />Ambiente interno</div>
          <div className="admin-topbar-context"><ShieldCheck size={17} />Acesso protegido e auditado</div>
        </header>
        {access.mfaEnabled ? children : (
          <main className="admin-content">
            <AdminPageHeader
              eyebrow="Segurança"
              title="Ative a autenticação em duas etapas"
              description="A administração interna só fica disponível para contas com MFA ativo. Configure um aplicativo autenticador e volte a esta página."
              actions={<Link href="/configuracoes/seguranca" className="button-link">Configurar MFA</Link>}
            />
          </main>
        )}
      </section>
    </div>
  );
}
