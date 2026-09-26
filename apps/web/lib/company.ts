import { redirect } from "next/navigation";
import { listCompaniesForUser } from "@ax-finance/domain";

/**
 * P0 limita uma empresa por assinatura (Seção 17) — a primeira da lista já
 * é "a" empresa do usuário para qualquer tela que ainda não recebeu um
 * seletor de empresa explícito.
 */
export async function requirePrimaryCompany(userId: string) {
  const companies = await listCompaniesForUser(userId);
  if (companies.length === 0) {
    redirect("/onboarding");
  }
  return companies[0]!;
}
