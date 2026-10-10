import Link from "next/link";
import { redirect } from "next/navigation";
import { getLateFeeSettings, getPixSettings, listActiveCategories, listCostCenters, listFinancialAccounts, listParties, listTitlesPage } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { filterCategoriesByTitleType, sortCategoriesTree } from "@/lib/categories";
import { TitleListTable } from "@/components/titles/title-list-table";
import { Pagination } from "@/components/ui/pagination";
import { TitleListSummary } from "@/components/titles/title-list-summary";
import { TitleFilters } from "@/components/titles/title-filters";
import { ActionModal } from "@/components/ui/action-modal";
import { SubmitButton } from "@/components/ui/submit-button";
import { QuickCreateButton, QuickCreateOnParam } from "@/components/quick-create";
import { todayDateOnlyString } from "@/lib/dates";
import { isComparisonMode, periodQuery, resolvePeriodRange } from "@/lib/month";
import { parseTitleListQuery, type TitleListQuery } from "@/lib/title-list-params";
import { updateLateFeeAction, updatePixSettingsAction } from "../titulos-actions";

type Filter = "vencidas" | "hoje" | "proximas" | "quitadas" | "todas";

const FILTER_LABEL: Record<Filter, string> = {
  todas: "Todas",
  vencidas: "Vencidas",
  hoje: "Hoje",
  proximas: "Próximas",
  quitadas: "Quitadas",
};

type SearchParams = TitleListQuery & {
  filtro?: string; pagina?: string; mes?: string; de?: string; ate?: string; periodo?: string; comparar?: string;
  erro?: string; erroBaixa?: string; titulo?: string; baixado?: string; cobrado?: string; multaSalva?: string; pixSalvo?: string; loteConcluido?: string; novo?: string;
};

const percent = (bps: number) => (bps / 100).toFixed(2).replace(".", ",");

export default async function EntradasPage(props: { searchParams: Promise<SearchParams> }) {
  const searchParams = await props.searchParams;
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const company = await requirePrimaryCompany(user.id);

  const [categories, clients, costCenters, allAccounts, lateFee, pix] = await Promise.all([
    listActiveCategories(user.id, company.id),
    listParties(user.id, company.id, { role: "CLIENT", status: "ACTIVE" }),
    listCostCenters(user.id, company.id),
    listFinancialAccounts(user.id, company.id),
    getLateFeeSettings(user.id, company.id),
    getPixSettings(user.id, company.id),
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
    ...parseTitleListQuery(searchParams),
  });
  const titles = listing.titles;
  const params = Object.fromEntries(Object.entries(searchParams).filter((entry): entry is [string, string] => typeof entry[1] === "string"));

  const filterHref = (key: Filter) => {
    const next = new URLSearchParams(periodQuery(period, isComparisonMode(searchParams.comparar) ? searchParams.comparar : null));
    for (const keep of ["q", "categoria", "pessoa", "centro", "min", "max", "ordem", "dir"] as const) if (searchParams[keep]) next.set(keep, searchParams[keep]!);
    if (key !== "todas") next.set("filtro", key);
    const query = next.toString();
    return query ? `/entradas?${query}` : "/entradas";
  };
  const exportQuery = new URLSearchParams({ tipo: "RECEIVABLE" });
  for (const [key, value] of Object.entries(params)) if (!["pagina", "erro", "erroBaixa", "titulo", "baixado", "cobrado", "multaSalva", "pixSalvo", "loteConcluido", "novo"].includes(key)) exportQuery.set(key, value);
  const resultParams = ["pagina", "erro", "erroBaixa", "titulo", "baixado", "cobrado", "multaSalva", "pixSalvo", "loteConcluido", "novo"];
  const returnQuery = new URLSearchParams(Object.entries(params).filter(([key]) => !resultParams.includes(key))).toString();
  const returnTo = returnQuery ? `/entradas?${returnQuery}` : "/entradas";

  return (
    <main className="wide">
      <div className="page-header">
        <h1>Entradas</h1>
        <div className="page-header-actions">
          <Link href="/entradas/recorrencias" className="button-link">
            Recorrências
          </Link>
          <Link href="/entradas/parcelado" className="button-link">
            Parcelar
          </Link>
          <a href={`/api/titles/export?${exportQuery.toString()}`} className="button-link" download>
            Exportar CSV
          </a>
          <ActionModal triggerLabel={pix.configured ? "PIX ✓" : "PIX"} title="Recebimento por PIX">
            <p className="subtitle">Com a chave configurada, a cobrança de cada entrada já traz o QR Code e o &ldquo;PIX copia e cola&rdquo; com o valor em aberto. O dinheiro cai direto na sua conta: o sistema só monta o código.</p>
            <form action={updatePixSettingsAction.bind(null, returnTo)}>
              <label htmlFor="pixKey">Chave PIX</label>
              <input id="pixKey" name="pixKey" type="text" maxLength={120} defaultValue={pix.pixKey ?? ""} placeholder="CPF, CNPJ, e-mail, celular ou chave aleatória" />
              <label htmlFor="pixReceiverName">Nome de quem recebe</label>
              <input id="pixReceiverName" name="pixReceiverName" type="text" maxLength={60} defaultValue={pix.pixReceiverName} />
              <label htmlFor="pixCity">Cidade</label>
              <input id="pixCity" name="pixCity" type="text" maxLength={60} defaultValue={pix.pixCity ?? ""} placeholder="Ex.: São Paulo" />
              <p className="muted">Nome e cidade aparecem no app do banco de quem paga (até 25 e 15 letras). Deixe a chave em branco para tirar o PIX das cobranças.</p>
              <SubmitButton>Salvar</SubmitButton>
            </form>
          </ActionModal>
          <ActionModal triggerLabel="Multa e juros" title="Multa e juros por atraso">
            <p className="subtitle">Ao receber um título vencido, o sistema sugere multa e juros com estes percentuais. É só sugestão: você confere e pode alterar na hora.</p>
            <form action={updateLateFeeAction.bind(null, returnTo)}>
              <label htmlFor="lateFee">Multa por atraso (%, uma vez)</label>
              <input id="lateFee" name="lateFee" type="text" inputMode="decimal" defaultValue={percent(lateFee.lateFeeBps)} placeholder="2,00" />
              <label htmlFor="lateInterest">Juros ao mês (%)</label>
              <input id="lateInterest" name="lateInterest" type="text" inputMode="decimal" defaultValue={percent(lateFee.lateInterestMonthlyBps)} placeholder="1,00" />
              <p className="muted">Os juros são proporcionais aos dias de atraso (mês de 30 dias). Máximo de 20% em cada campo; zero desliga a sugestão.</p>
              <SubmitButton>Salvar</SubmitButton>
            </form>
          </ActionModal>
          <QuickCreateButton kind="RECEIVABLE" className="button-link workspace-primary-action">+ Novo lançamento</QuickCreateButton>
        </div>
      </div>
      <QuickCreateOnParam kind="RECEIVABLE" />

      {searchParams.erro ? <p className="error">{searchParams.erro}</p> : null}
      {searchParams.baixado ? <p className="success-box">Recebimento registrado.</p> : null}
      {searchParams.cobrado ? <p className="success-box">Cobrança registrada.</p> : null}
      {searchParams.multaSalva ? <p className="success-box">Multa e juros salvos.</p> : null}
      {searchParams.pixSalvo ? <p className="success-box">Recebimento por PIX salvo. As cobranças já saem com o QR Code.</p> : null}

      <div className="filters">
        {(Object.keys(FILTER_LABEL) as Filter[]).map((key) => (
          <Link key={key} href={filterHref(key)} className={filter === key ? "active" : ""} aria-current={filter === key ? "page" : undefined}>
            {FILTER_LABEL[key]}
          </Link>
        ))}
      </div>
      {filter === "vencidas" || filter === "hoje" ? <p className="workspace-filter-note">{filter === "vencidas" ? "Vencidas de todos os meses." : "Vencimentos de hoje em qualquer período."} O seletor de período acima não limita esta lista.</p> : null}

      <TitleFilters
        basePath="/entradas"
        params={params}
        categories={sortCategoriesTree(filterCategoriesByTitleType(categories, "RECEIVABLE"))}
        parties={clients}
        costCenters={costCenters}
        partyLabel="Cliente"
      />

      <TitleListSummary summary={listing.summary} total={listing.total} kind="entradas" overdueView={filter === "vencidas"} scopeNote={filter === "vencidas" || filter === "hoje" ? "Todas as datas" : "Conforme período e filtros acima"} />

      <div className="card">
        {searchParams.loteConcluido ? <p className="success-box">Operação concluída em {searchParams.loteConcluido} entrada(s).</p> : null}
        <TitleListTable
          titles={titles}
          basePath="/entradas"
          userId={user.id}
          companyId={company.id}
          params={params}
          accounts={allAccounts.filter((account) => account.status === "ACTIVE")}
          today={today}
          lateFee={lateFee}
          companyName={company.name}
          pix={pix}
        />
        <Pagination basePath="/entradas" params={params} page={listing.page} pageCount={listing.pageCount} total={listing.total} pageSize={listing.pageSize} />
      </div>
    </main>
  );
}
