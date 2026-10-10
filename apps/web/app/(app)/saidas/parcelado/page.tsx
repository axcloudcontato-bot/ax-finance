import { redirect } from "next/navigation";
import { listActiveCategories, listCostCenters, listParties } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { filterCategoriesByTitleType, sortCategoriesTree } from "@/lib/categories";
import { InstallmentForm } from "@/components/titles/installment-form";
import { createSaidaInstallmentPlanAction } from "../actions";

export default async function SaidaParceladaPage(
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

  const [categories, suppliers, costCenters] = await Promise.all([
    listActiveCategories(user.id, company.id),
    listParties(user.id, company.id, { role: "SUPPLIER", status: "ACTIVE" }),
    listCostCenters(user.id, company.id),
  ]);

  return (
    <main>
      <div className="page-header">
        <div><h1>Parcelar saída</h1><p className="subtitle">Divide um valor em parcelas mensais: cada parcela vira uma saída com o próprio vencimento.</p></div>
      </div>
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
