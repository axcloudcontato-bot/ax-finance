import Link from "next/link";
import { redirect } from "next/navigation";
import { listActiveCategories, listCostCenters, listFinancialAccounts, listParties, listTitlesPage } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { filterCategoriesByTitleType, sortCategoriesTree } from "@/lib/categories";
import { TitleListTable } from "@/components/titles/title-list-table";
import { Pagination } from "@/components/ui/pagination";
import { TitleListSummary } from "@/components/titles/title-list-summary";
import { TitleFilters } from "@/components/titles/title-filters";
import { QuickCreateButton, QuickCreateOnParam } from "@/components/quick-create";
import { todayDateOnlyString } from "@/lib/dates";
import { isComparisonMode, periodQuery, resolvePeriodRange } from "@/lib/month";
import { parseTitleListQuery, type TitleListQuery } from "@/lib/title-list-params";

type Filter = "vencidas" | "hoje" | "proximas" | "quitadas" | "todas";

const FILTER_LABEL: Record<Filter, string> = {
  todas: "Todas",
  vencidas: "Vencidas",
  hoje: "Hoje",
  proximas: "Próximas",
  quitadas: "Pagas",
};

type SearchParams = TitleListQuery & {
  filtro?: string; pagina?: string; mes?: string; de?: string; ate?: string; periodo?: string; comparar?: string;
  erro?: string; erroBaixa?: string; titulo?: string; baixado?: string; agendado?: string; loteConcluido?: string; novo?: string;
};

export default async function SaidasPage(props: { searchParams: Promise<SearchParams> }) {
  const searchParams = await props.searchParams;
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const company = await requirePrimaryCompany(user.id);

  const [categories, suppliers, costCenters, allAccounts] = await Promise.all([
    listActiveCategories(user.id, company.id),
    listParties(user.id, company.id, { role: "SUPPLIER", status: "ACTIVE" }),
    listCostCenters(user.id, company.id),
    listFinancialAccounts(user.id, company.id),
  ]);

  const filter: Filter = (["todas", "vencidas", "hoje", "proximas", "quitadas"] as const).includes(searchParams.filtro as Filter) ? (searchParams.filtro as Filter) : "todas";
  const period = resolvePeriodRange(searchParams);
  const { from: monthFrom, to: monthTo } = period;
  const today = todayDateOnlyString();
  const requestedPage = Number.parseInt(searchParams.pagina ?? "1", 10);
  const listing = await listTitlesPage(user.id, company.id, {
    type: "PAYABLE",
    view: filter,
    from: monthFrom,
    to: monthTo,
    today,
    page: Number.isFinite(requestedPage) ? requestedPage : 1,
    ...parseTitleListQuery(searchParams),
  });
  const titles = listing.titles;
  const params = Object.fromEntries(Object.entries(searchParams).filter((entry): entry is [string, string] => typeof entry[1] === "string"));

  const filterHref = (key: Filter) => {
    const next = new URLSearchParams(periodQuery(period, isComparisonMode(searchParams.comparar) ? searchParams.comparar : null));
    for (const keep of ["q", "categoria", "pessoa", "centro", "min", "max", "ordem", "dir"] as const) if (searchParams[keep]) next.set(keep, searchParams[keep]!);
    if (key !== "todas") next.set("filtro", key);
    const query = next.toString();
    return query ? `/saidas?${query}` : "/saidas";
  };
  const exportQuery = new URLSearchParams({ tipo: "PAYABLE" });
  for (const [key, value] of Object.entries(params)) if (!["pagina", "erro", "erroBaixa", "titulo", "baixado", "agendado", "loteConcluido", "novo"].includes(key)) exportQuery.set(key, value);

  return (
    <main className="wide">
      <div className="page-header">
        <h1>Saídas</h1>
        <div className="page-header-actions">
          <Link href="/saidas/recorrencias" className="button-link">
            Recorrências
          </Link>
          <Link href="/saidas/parcelado" className="button-link">
            Parcelar
          </Link>
          <a href={`/api/titles/export?${exportQuery.toString()}`} className="button-link" download>
            Exportar CSV
          </a>
          <QuickCreateButton kind="PAYABLE" className="button-link workspace-primary-action">+ Novo lançamento</QuickCreateButton>
        </div>
      </div>
      <QuickCreateOnParam kind="PAYABLE" />

      {searchParams.erro ? <p className="error">{searchParams.erro}</p> : null}
      {searchParams.baixado ? <p className="success-box">Pagamento registrado.</p> : null}
      {searchParams.agendado ? <p className="success-box">{searchParams.agendado === "1" ? "Pagamento agendado." : "Agendamento removido."}</p> : null}

      <div className="filters">
        {(Object.keys(FILTER_LABEL) as Filter[]).map((key) => (
          <Link key={key} href={filterHref(key)} className={filter === key ? "active" : ""} aria-current={filter === key ? "page" : undefined}>
            {FILTER_LABEL[key]}
          </Link>
        ))}
      </div>
      {filter === "vencidas" || filter === "hoje" ? <p className="workspace-filter-note">{filter === "vencidas" ? "Vencidas de todos os meses." : "Vencimentos de hoje em qualquer período."} O seletor de período acima não limita esta lista.</p> : null}

      <TitleFilters
        basePath="/saidas"
        params={params}
        categories={sortCategoriesTree(filterCategoriesByTitleType(categories, "PAYABLE"))}
        parties={suppliers}
        costCenters={costCenters}
        partyLabel="Fornecedor"
      />

      <TitleListSummary summary={listing.summary} total={listing.total} kind="saídas" overdueView={filter === "vencidas"} scopeNote={filter === "vencidas" || filter === "hoje" ? "Todas as datas" : "Conforme período e filtros acima"} />

      <div className="card">
        {searchParams.loteConcluido ? <p className="success-box">Operação concluída em {searchParams.loteConcluido} saída(s).</p> : null}
        <TitleListTable
          titles={titles}
          basePath="/saidas"
          userId={user.id}
          companyId={company.id}
          params={params}
          accounts={allAccounts.filter((account) => account.status === "ACTIVE")}
          today={today}
          lateFee={{ lateFeeBps: 0, lateInterestMonthlyBps: 0 }}
          companyName={company.name}
        />
        <Pagination basePath="/saidas" params={params} page={listing.page} pageCount={listing.pageCount} total={listing.total} pageSize={listing.pageSize} />
      </div>
    </main>
  );
}
