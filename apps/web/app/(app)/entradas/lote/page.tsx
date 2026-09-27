import Link from "next/link";
import { redirect } from "next/navigation";
import { listActiveCategories, listCostCenters, listFinancialAccounts, listTitles } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { filterCategoriesByTitleType, sortCategoriesTree } from "@/lib/categories";
import { TitleBatchPreview } from "@/components/titles/title-batch-preview";
import { executeTitleBatchAction } from "../../lote-actions";

export default async function EntradaBatchPage({searchParams}:{searchParams:{ids?:string|string[];erro?:string}}){
  const user=await getCurrentUser();if(!user)redirect("/login");const company=await requirePrimaryCompany(user.id);
  const ids=Array.isArray(searchParams.ids)?searchParams.ids:searchParams.ids?[searchParams.ids]:[];
  const [all,categories,accounts,costCenters]=await Promise.all([listTitles(user.id,company.id,{type:"RECEIVABLE"}),listActiveCategories(user.id,company.id),listFinancialAccounts(user.id,company.id),listCostCenters(user.id,company.id)]);
  const selected=all.filter((title)=>ids.includes(title.id));
  return <main className="wide"><div className="page-header"><div><h1>Operações em lote — entradas</h1><p className="subtitle">Revise a seleção antes de confirmar.</p></div><Link href="/entradas" className="button-link">Voltar</Link></div>{selected.length?<TitleBatchPreview titles={selected} categories={sortCategoriesTree(filterCategoriesByTitleType(categories,"RECEIVABLE"))} accounts={accounts} costCenters={costCenters} action={executeTitleBatchAction.bind(null,"entradas")} error={searchParams.erro} noun="entrada"/>:<div className="card"><p className="muted">Selecione ao menos uma entrada na lista.</p><Link href="/entradas">Voltar para entradas</Link></div>}</main>;
}
