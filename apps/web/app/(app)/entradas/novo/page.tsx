import { redirect } from "next/navigation";
import { listActiveCategories, listParties } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { sortCategoriesTree } from "@/lib/categories";
import { TitleForm } from "@/components/titles/title-form";
import { createEntradaAction } from "../actions";

export default async function NovaEntradaPage({
  searchParams,
}: {
  searchParams: { erro?: string };
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const company = await requirePrimaryCompany(user.id);

  const categories = await listActiveCategories(user.id, company.id);
  const clients = await listParties(user.id, company.id, { role: "CLIENT", status: "ACTIVE" });

  return (
    <main>
      <h1 style={{ marginBottom: "1rem" }}>Nova entrada</h1>
      <TitleForm
        action={createEntradaAction}
        categories={sortCategoriesTree(categories)}
        parties={clients}
        partyLabel="Cliente"
        error={searchParams.erro}
      />
    </main>
  );
}
