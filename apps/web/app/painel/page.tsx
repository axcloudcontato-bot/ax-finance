import { redirect } from "next/navigation";
import { getPlatformAdminAccess, listCompaniesForUser } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";

// Destino pós-login: leva direto ao dashboard (ou admin/onboarding) em vez da landing.
export const dynamic = "force-dynamic";

export default async function PainelRedirectPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [companies, platformAdmin] = await Promise.all([
    listCompaniesForUser(user.id),
    getPlatformAdminAccess(user.id),
  ]);

  redirect(
    companies.length > 0
      ? `/dashboard?empresa=${companies[0]!.id}`
      : platformAdmin
        ? "/admin"
        : "/onboarding"
  );
}
