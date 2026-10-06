import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowDownCircle } from "@/components/ui/animated-icons";
import { listActiveCategories, listCostCenters, listParties, listTitlesPage } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { filterCategoriesByTitleType, sortCategoriesTree } from "@/lib/categories";
import { TitleListTable } from "@/components/titles/title-list-table";
import { Pagination } from "@/components/ui/pagination";
import { TitleListSummary } from "@/components/titles/title-list-summary";
import { TitleForm } from "@/components/titles/title-form";
import { Modal } from "@/components/ui/modal";
import { todayDateOnlyString } from "@/lib/dates";
import { isComparisonMode, periodQuery, resolvePeriodRange } from "@/lib/month";
import { createEntradaAction, createEntradaAndContinueAction } from "./actions";

type Filter = "vencidas" | "hoje" | "proximas" | "quitadas" | "todas";

const FILTER_LABEL: Record<Filter, string> = {
  todas: "Todas",
  vencidas: "Vencidas",
  hoje: "Hoje",
  proximas: "Próximas",
  quitadas: "Quitadas",
};

export default async function EntradasPage(
  props: {
    searchParams: Promise<{ filtro?: string; pagina?: string; mes?: string; de?: string; ate?: string; periodo?: string; comparar?: string; erro?: string; continuar?: string; criado?: string; loteConcluido?: string }>;
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

  const filter: Filter = (["todas", "vencidas", "hoje", "proximas", "quitadas"] as const).includes(searchParams.filtro as Filter) ? (searchParams.filtro as Filter) : "todas";
  const period = resolvePeriodRange(searchParams);
  const { from: monthFrom, to: monthTo } = period;
  const today = todayDateOnlyString();
  const requestedPage = Number.parseInt(searchParams.pagina ?? "1", 10);
  const listing = await listTitlesPage(user.id, company.id, {
    type: "RECEIVABLE",
    view: filter,
    from: monthFrom,
    to: monthTo,
    today,
    page: Number.isFinite(requestedPage) ? requestedPage : 1,
  });
  const titles = listing.titles;

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
            triggerClassName="button-link workspace-primary-action"
            title="Nova entrada"
            icon={<ArrowDownCircle className="size-5" strokeWidth={1.5} />}
            maxWidth="720px"
            openWhen="novo"
          >
            <TitleForm
              action={createEntradaAction}
              actionAndContinue={createEntradaAndContinueAction}
              categories={sortCategoriesTree(filterCategoriesByTitleType(categories, "RECEIVABLE"))}
              parties={clients}
              costCenters={costCenters}
              partyLabel="Cliente"
              kind="RECEIVABLE"
              error={searchParams.erro}
            />
          </Modal>
        </div>
      </div>

      <div className="filters">
        {(Object.keys(FILTER_LABEL) as Filter[]).map((key) => (
          <Link key={key} href={filterHref(key)} className={filter === key ? "active" : ""} aria-current={filter === key ? "page" : undefined}>
            {FILTER_LABEL[key]}
          </Link>
        ))}
      </div>
      {filter === "vencidas" || filter === "hoje" ? <p className="workspace-filter-note">{filter === "vencidas" ? "Vencidas de todos os meses." : "Vencimentos de hoje em qualquer período."} O seletor de período acima não limita esta lista.</p> : null}

      <TitleListSummary summary={listing.summary} total={listing.total} kind="entradas" overdueView={filter === "vencidas"} scopeNote={filter === "vencidas" || filter === "hoje" ? "Todas as datas" : "Conforme período e filtro acima"} />

      <div className="card">
        {searchParams.loteConcluido ? <p className="success-box">Operação concluída em {searchParams.loteConcluido} entrada(s).</p> : null}
        <TitleListTable titles={titles} basePath="/entradas" userId={user.id} companyId={company.id} />
        <Pagination basePath="/entradas" params={searchParams} page={listing.page} pageCount={listing.pageCount} total={listing.total} pageSize={listing.pageSize} />
      </div>
    </main>
  );
}
