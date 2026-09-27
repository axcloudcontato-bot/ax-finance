import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowDownCircle } from "lucide-react";
import { listActiveCategories, listCostCenters, listParties, listTitles } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { filterCategoriesByTitleType, sortCategoriesTree } from "@/lib/categories";
import { TitleListTable } from "@/components/titles/title-list-table";
import { TitleForm } from "@/components/titles/title-form";
import { Modal } from "@/components/ui/modal";
import { toDateOnlyString, todayDateOnlyString } from "@/lib/dates";
import { isComparisonMode, periodQuery, resolvePeriodRange } from "@/lib/month";
import { createEntradaAction, createEntradaAndContinueAction } from "./actions";

type Filter = "vencidas" | "hoje" | "proximas" | "quitadas" | "todas";

const FILTER_LABEL: Record<Filter, string> = {
  vencidas: "Vencidas",
  hoje: "Hoje",
  proximas: "Próximas",
  quitadas: "Quitadas",
  todas: "Todas",
};

export default async function EntradasPage({
  searchParams,
}: {
  searchParams: { filtro?: string; mes?: string; de?: string; ate?: string; periodo?: string; comparar?: string; erro?: string; continuar?: string; criado?: string; loteConcluido?: string };
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const company = await requirePrimaryCompany(user.id);

  const [allTitles, categories, clients, costCenters] = await Promise.all([
    listTitles(user.id, company.id, { type: "RECEIVABLE" }),
    listActiveCategories(user.id, company.id),
    listParties(user.id, company.id, { role: "CLIENT", status: "ACTIVE" }),
    listCostCenters(user.id, company.id),
  ]);

  const filter = (searchParams.filtro as Filter) ?? "todas";
  const period = resolvePeriodRange(searchParams);
  const { from: monthFrom, to: monthTo } = period;
  const today = todayDateOnlyString();

  const titles = allTitles.filter((title) => {
    const due = toDateOnlyString(title.dueDate);
    if (due < monthFrom || due > monthTo) return false;

    if (filter === "todas") return true;
    if (filter === "quitadas") return title.status === "SETTLED";
    if (title.status === "SETTLED" || title.status === "CANCELLED") return false;

    if (filter === "vencidas") return due < today;
    if (filter === "hoje") return due === today;
    if (filter === "proximas") return due > today;
    return true;
  });

  const filterHref = (key: Filter) => {
    const params = new URLSearchParams(periodQuery(period, isComparisonMode(searchParams.comparar) ? searchParams.comparar : null));
    if (key !== "todas") params.set("filtro", key);
    const query = params.toString();
    return query ? `/entradas?${query}` : "/entradas";
  };
  return (
    <main className="wide">
      <div className="page-header">
        <h1>Entradas</h1>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <Link href="/entradas/recorrencias" className="button-link">
            Recorrências
          </Link>
          <Link href="/entradas/parcelado" className="button-link">
            Parcelar
          </Link>
          <Modal
            key={searchParams.continuar ?? "novo"}
            triggerLabel="+ Novo lançamento"
            title="Nova entrada"
            icon={<ArrowDownCircle className="size-5" strokeWidth={1.5} />}
            maxWidth="720px"
          >
            <TitleForm
              action={createEntradaAction}
              actionAndContinue={createEntradaAndContinueAction}
              categories={sortCategoriesTree(filterCategoriesByTitleType(categories, "RECEIVABLE"))}
              parties={clients}
              costCenters={costCenters}
              partyLabel="Cliente"
              error={searchParams.erro}
            />
          </Modal>
        </div>
      </div>

      <div className="filters">
        {(Object.keys(FILTER_LABEL) as Filter[]).map((key) => (
          <Link key={key} href={filterHref(key)} className={filter === key ? "active" : ""}>
            {FILTER_LABEL[key]}
          </Link>
        ))}
      </div>

      <div className="card">
        {searchParams.loteConcluido ? <p className="success-box">Operação concluída em {searchParams.loteConcluido} entrada(s).</p> : null}
        <TitleListTable titles={titles} basePath="/entradas" />
      </div>
    </main>
  );
}
