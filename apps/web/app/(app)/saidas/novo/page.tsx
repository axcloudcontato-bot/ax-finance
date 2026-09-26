import { redirect } from "next/navigation";
import { listActiveCategories, listParties } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { sortCategoriesTree } from "@/lib/categories";
import { TitleForm } from "@/components/titles/title-form";
import { createSaidaAction } from "../actions";

export default async function NovaSaidaPage({
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
  const suppliers = await listParties(user.id, company.id, { role: "SUPPLIER", status: "ACTIVE" });

  return (
    <main>
      <h1 style={{ marginBottom: "1rem" }}>Nova saída</h1>
      <TitleForm
        action={createSaidaAction}
        categories={sortCategoriesTree(categories)}
        parties={suppliers}
        partyLabel="Fornecedor"
        error={searchParams.erro}
      />
    </main>
  );
}
