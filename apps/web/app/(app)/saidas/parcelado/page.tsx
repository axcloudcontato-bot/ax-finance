import { redirect } from "next/navigation";
import { listActiveCategories, listParties } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { sortCategoriesTree } from "@/lib/categories";
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

  const categories = await listActiveCategories(user.id, company.id);
  const suppliers = await listParties(user.id, company.id, { role: "SUPPLIER", status: "ACTIVE" });

  return (
    <main>
      <h1 style={{ marginBottom: "1rem" }}>Parcelar saída</h1>
      <InstallmentForm
        action={createSaidaInstallmentPlanAction}
        categories={sortCategoriesTree(categories)}
        parties={suppliers}
        partyLabel="Fornecedor"
        error={searchParams.erro}
      />
    </main>
  );
}
