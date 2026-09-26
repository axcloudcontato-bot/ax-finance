import { redirect } from "next/navigation";
import { listActiveCategories, listParties } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { filterCategoriesByTitleType, sortCategoriesTree } from "@/lib/categories";
import { InstallmentForm } from "@/components/titles/installment-form";
import { createEntradaInstallmentPlanAction } from "../actions";

export default async function EntradaParceladaPage({
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
      <h1 style={{ marginBottom: "1rem" }}>Parcelar entrada</h1>
      <InstallmentForm
        action={createEntradaInstallmentPlanAction}
        categories={sortCategoriesTree(filterCategoriesByTitleType(categories, "RECEIVABLE"))}
        parties={clients}
        partyLabel="Cliente"
        error={searchParams.erro}
      />
    </main>
  );
}
