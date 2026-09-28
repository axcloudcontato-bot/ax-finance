import { redirect } from "next/navigation";
import { getPlatformAdminAccess, listCompaniesForUser } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";

export default async function RootPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const [companies, platformAdmin] = await Promise.all([
    listCompaniesForUser(user.id),
    getPlatformAdminAccess(user.id)
  ]);

  if (companies.length === 0) {
    if (platformAdmin) {
      redirect("/admin");
    }

    redirect("/onboarding");
  }

  redirect(`/dashboard?empresa=${companies[0]!.id}`);
}
