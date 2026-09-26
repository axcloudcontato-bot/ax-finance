import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { listCompaniesForUser } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { AppShell } from "@/components/app-shell";
import { logoutAction } from "./actions";

// Casca compartilhada por toda tela autenticada (Seção 4 do DIRECAO.md: menu
// principal fixo, empresa ativa sempre visível). P0 limita uma empresa por
// assinatura (Seção 17), então a primeira da lista já é "a" empresa ativa
// para fins de cabeçalho/sidebar — a página de cada rota ainda decide o que
// fazer com múltiplas empresas via searchParams quando isso mudar.
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const companies = await listCompaniesForUser(user.id);
  if (companies.length === 0) {
    redirect("/onboarding");
  }

  const primaryCompany = companies[0]!;

  return (
    <AppShell
      companyName={primaryCompany.name}
      userName={user.name}
      userEmail={user.email}
      logoutAction={logoutAction}
    >
      {children}
    </AppShell>
  );
}
