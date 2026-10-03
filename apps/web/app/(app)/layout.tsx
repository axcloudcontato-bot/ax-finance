import type { Metadata } from "next";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCompanyAccess, getCompanyPlanAccess, getPlatformAdminAccess, listCompaniesForUser, listNotifications } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { AppShell } from "@/components/app-shell";
import { logoutAction } from "./actions";
import { noIndexMetadata } from "@/lib/site";

export const metadata: Metadata = noIndexMetadata;

// Mesma regra do applyTheme() do BottomMenu (chave ax-finance:theme:v1).
const THEME_BOOTSTRAP = `try{var p=localStorage.getItem("ax-finance:theme:v1");var t=p==="dark"||p==="light"?p:(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");var r=document.documentElement;r.dataset.axTheme=t;r.style.colorScheme=t}catch(e){}`;

// Casca compartilhada por toda tela autenticada (Seção 4 do DIRECAO.md: menu
// principal fixo). P0 limita uma empresa por assinatura (Seção 17) — a
// página de cada rota ainda decide o que fazer com múltiplas empresas via
// searchParams quando isso mudar.
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const companies = await listCompaniesForUser(user.id);
  if (companies.length === 0) {
    redirect("/onboarding");
  }

  const company = await requirePrimaryCompany(user.id);
  const [notifications, access, planAccess, platformAdmin] = await Promise.all([
    listNotifications(user.id, company.id),
    getCompanyAccess(user.id, company.id),
    getCompanyPlanAccess(user.id, company.id),
    getPlatformAdminAccess(user.id),
  ]);

  return (
    <>
    {/* Aplica o tema salvo antes da primeira pintura; sem isto cada carregamento
        completo piscava em claro até o BottomMenu hidratar. */}
    <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
    <AppShell
      userName={user.name}
      userEmail={user.email}
      membershipRole={access.role}
      canManageMembers={access.permissions.includes("MEMBERS_MANAGE")}
      isPlatformAdmin={Boolean(platformAdmin)}
      planCode={planAccess.code}
      logoutAction={logoutAction}
      notifications={notifications.map((notification) => ({
        id: notification.id,
        title: notification.title,
        body: notification.body,
        href: notification.href,
        readAt: notification.readAt,
        createdAt: notification.createdAt,
      }))}
    >
      {children}
    </AppShell>
    </>
  );
}
