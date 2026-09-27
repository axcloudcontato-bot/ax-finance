import { redirect } from "next/navigation";
import { listActiveCategories, listCostCenters, listParties } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { filterCategoriesByTitleType, sortCategoriesTree } from "@/lib/categories";
import { InstallmentForm } from "@/components/titles/installment-form";
import { createSaidaInstallmentPlanAction } from "../actions";

export default async function SaidaParceladaPage({
  searchParams,
}: {
  searchParams: { erro?: string };
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const company = await requirePrimaryCompany(user.id);

  const [categories, suppliers, costCenters] = await Promise.all([
    listActiveCategories(user.id, company.id),
    listParties(user.id, company.id, { role: "SUPPLIER", status: "ACTIVE" }),
    listCostCenters(user.id, company.id),
  ]);

  return (
    <main>
      <h1 style={{ marginBottom: "1rem" }}>Parcelar saída</h1>
      <InstallmentForm
        action={createSaidaInstallmentPlanAction}
        categories={sortCategoriesTree(filterCategoriesByTitleType(categories, "PAYABLE"))}
        parties={suppliers}
        costCenters={costCenters}
        partyLabel="Fornecedor"
        error={searchParams.erro}
      />
    </main>
  );
}
