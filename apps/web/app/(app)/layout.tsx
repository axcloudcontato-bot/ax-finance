import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCompanyAccess, listCompaniesForUser, listDueSoonTitles } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { AppShell } from "@/components/app-shell";
import { logoutAction } from "./actions";

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
  const [dueSoonTitles, access] = await Promise.all([
    listDueSoonTitles(user.id, company.id),
    getCompanyAccess(user.id, company.id),
  ]);

  return (
    <AppShell
      userName={user.name}
      userEmail={user.email}
      membershipRole={access.role}
      canManageMembers={access.permissions.includes("MEMBERS_MANAGE")}
      logoutAction={logoutAction}
      dueSoonTitles={dueSoonTitles.map((title) => ({
        id: title.id,
        type: title.type,
        description: title.description,
        dueDate: title.dueDate,
      }))}
    >
      {children}
    </AppShell>
  );
}
