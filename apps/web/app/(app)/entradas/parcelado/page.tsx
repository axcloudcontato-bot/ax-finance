import { redirect } from "next/navigation";
import { listActiveCategories, listCostCenters, listParties } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { filterCategoriesByTitleType, sortCategoriesTree } from "@/lib/categories";
import { InstallmentForm } from "@/components/titles/installment-form";
import { createEntradaInstallmentPlanAction } from "../actions";

export default async function EntradaParceladaPage(
  props: {
    searchParams: Promise<{ erro?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const company = await requirePrimaryCompany(user.id);

  const [categories, clients, costCenters] = await Promise.all([
    listActiveCategories(user.id, company.id),
    listParties(user.id, company.id, { role: "CLIENT", status: "ACTIVE" }),
    listCostCenters(user.id, company.id),
  ]);

  return (
    <main>
      <div className="page-header">
        <div><h1>Parcelar entrada</h1><p className="subtitle">Divide um valor em parcelas mensais: cada parcela vira uma entrada com o próprio vencimento.</p></div>
      </div>
      <InstallmentForm
        action={createEntradaInstallmentPlanAction}
        categories={sortCategoriesTree(filterCategoriesByTitleType(categories, "RECEIVABLE"))}
        parties={clients}
        costCenters={costCenters}
        partyLabel="Cliente"
        error={searchParams.erro}
      />
    </main>
  );
}
