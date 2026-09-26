import { redirect } from "next/navigation";
import { listCompaniesForUser } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";

export default async function RootPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const companies = await listCompaniesForUser(user.id);
  if (companies.length === 0) {
    redirect("/onboarding");
  }

  redirect(`/dashboard?empresa=${companies[0]!.id}`);
}
