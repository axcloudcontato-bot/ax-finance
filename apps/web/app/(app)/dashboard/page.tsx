import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, ArrowDownCircle, ArrowUpCircle, CircleCheck, Landmark, TrendingUp, Wallet } from "@/components/ui/animated-icons";
import {
  CompanyAccessDeniedError,
  assertActiveMembership,
  getDashboardOverview,
  listActiveCategories,
  listCompaniesForUser,
  listCostCenters,
  listFinancialAccounts,
  listParties,
} from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { formatCents } from "@/lib/currency";
import { formatDateOnly } from "@/lib/dates";
import { periodQuery, resolveComparison, resolvePeriodRange } from "@/lib/month";
import { sortCategoriesTree } from "@/lib/categories";
import { Reveal } from "@/components/gsap/reveal";
import { StatCard } from "@/components/dashboard/stat-card";
import { TitleDetailList } from "@/components/dashboard/title-detail-list";
import { CashProjectionChart } from "@/components/dashboard/cash-projection-chart";
import { DashboardFilters } from "@/components/dashboard/dashboard-filters";
import { QuickCreateButton } from "@/components/quick-create";

type DashboardData = Awaited<ReturnType<typeof getDashboardOverview>>;
type OpenTitle = DashboardData["periodOpenTitles"][number];

function summarizeOpenTitles(titles: OpenTitle[], type: "RECEIVABLE" | "PAYABLE") {
  const items = titles.filter((title) => title.type === type);
  return { items, totalCents: items.reduce((sum, title) => sum + title.remainingCents, BigInt(0)) };
}

function comparisonValue(current: bigint, previous: bigint) {
  if (previous === BigInt(0)) return current === BigInt(0) ? "Sem variação" : "Sem base comparável";
  const difference = current - previous;
  const percent = Number((difference * BigInt(10_000)) / (previous < BigInt(0) ? -previous : previous)) / 100;
  return `${formatCents(previous)} · ${difference > BigInt(0) ? "+" : ""}${percent.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

function SettlementList({ entries }: { entries: DashboardData["currentSettlements"] }) {
  if (entries.length === 0) return <p className="muted">Nenhuma baixa realizada neste grupo.</p>;
  return (
    <table className="dashboard-detail-table">
      <thead><tr><th>Data</th><th>Título</th><th>Conta</th><th>Valor em caixa</th></tr></thead>
      <tbody>{entries.map((entry) => (
        <tr key={entry.id}>
          <td data-label="Data">{formatDateOnly(entry.effectiveDate)}</td>
          <td data-label="Título"><Link href={entry.titleType === "RECEIVABLE" ? `/entradas/${entry.titleId}` : `/saidas/${entry.titleId}`}>{entry.titleDescription}</Link></td>
          <td data-label="Conta">{entry.accountName}</td>
          <td data-label="Valor em caixa">{formatCents(entry.cashDeltaCents < BigInt(0) ? -entry.cashDeltaCents : entry.cashDeltaCents)}</td>
        </tr>
      ))}</tbody>
    </table>
  );
}

function CategoryRanking({ ranking }: { ranking: DashboardData["categoryRanking"] }) {
  if (ranking.length === 0) return <p className="muted">Nenhum movimento realizado no período.</p>;
  const visible = ranking.slice(0, 5);
  const remainder = ranking.slice(5);
  const rows = remainder.length > 0
    ? [...visible, { categoryId: "others", categoryName: "Outras", cents: remainder.reduce((sum, item) => sum + item.cents, BigInt(0)) }]
    : visible;
  const magnitude = (value: bigint) => value < BigInt(0) ? -value : value;
  const maximum = rows.reduce((max, item) => magnitude(item.cents) > max ? magnitude(item.cents) : max, BigInt(1));
  return (
    <div className="category-ranking">{rows.map((item) => {
      const width = Number((magnitude(item.cents) * BigInt(100)) / maximum);
      return (
        <div key={item.categoryId} className="category-ranking-row">
          <div><span>{item.categoryName}</span><strong className={item.cents < BigInt(0) ? "negative" : "positive"}>{formatCents(item.cents)}</strong></div>
          <span className="category-ranking-track"><span style={{ width: `${Math.max(width, 2)}%` }} /></span>
        </div>
      );
    })}</div>
  );
}

const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  BANK: "Conta bancária",
  CASH: "Dinheiro em caixa",
  WALLET: "Carteira de recebimentos",
};

export default async function DashboardPage(
  props: {
    searchParams: Promise<{
      empresa?: string; mes?: string; de?: string; ate?: string; periodo?: string; comparar?: string;
      conta?: string; categoria?: string; pessoa?: string; centroCusto?: string;
    }>;
  }
) {
  const searchParams = await props.searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const companies = await listCompaniesForUser(user.id);
  if (companies.length === 0) redirect("/onboarding");

  const activeCompanyId = searchParams.empresa ?? companies[0]!.id;
  const period = resolvePeriodRange(searchParams);
  const comparison = resolveComparison(searchParams, period);
  try {
    await assertActiveMembership(user.id, activeCompanyId);
  } catch (error) {
    if (error instanceof CompanyAccessDeniedError) redirect(`/dashboard?empresa=${companies[0]!.id}&${periodQuery(period, comparison?.mode)}`);
    throw error;
  }

  const [accounts, categories, parties, costCenters] = await Promise.all([
    listFinancialAccounts(user.id, activeCompanyId),
    listActiveCategories(user.id, activeCompanyId),
    listParties(user.id, activeCompanyId, { status: "ACTIVE" }),
    listCostCenters(user.id, activeCompanyId),
  ]);
  const activeAccounts = accounts.filter((account) => account.status === "ACTIVE");
  const selected = {
    conta: activeAccounts.some((item) => item.id === searchParams.conta) ? searchParams.conta : undefined,
    categoria: categories.some((item) => item.id === searchParams.categoria) ? searchParams.categoria : undefined,
    pessoa: parties.some((item) => item.id === searchParams.pessoa) ? searchParams.pessoa : undefined,
    centroCusto: costCenters.some((item) => item.id === searchParams.centroCusto) ? searchParams.centroCusto : undefined,
  };
  const segmentedView = Boolean(selected.conta || selected.categoria || selected.pessoa || selected.centroCusto);
  const overview = await getDashboardOverview(user.id, activeCompanyId, {
    from: period.from,
    to: period.to,
    comparisonFrom: comparison?.from,
    comparisonTo: comparison?.to,
    financialAccountId: selected.conta,
    categoryId: selected.categoria,
    partyId: selected.pessoa,
    costCenterId: selected.centroCusto,
  });

  const currentReceivables = summarizeOpenTitles(overview.periodOpenTitles, "RECEIVABLE");
  const currentPayables = summarizeOpenTitles(overview.periodOpenTitles, "PAYABLE");
  const previousReceivables = summarizeOpenTitles(overview.comparisonOpenTitles, "RECEIVABLE");
  const previousPayables = summarizeOpenTitles(overview.comparisonOpenTitles, "PAYABLE");
  const overdueReceivables = summarizeOpenTitles(overview.overdueTitles, "RECEIVABLE");
  const overduePayables = summarizeOpenTitles(overview.overdueTitles, "PAYABLE");
  const projectionReceivables = summarizeOpenTitles(overview.projectionTitles, "RECEIVABLE");
  const projectionPayables = summarizeOpenTitles(overview.projectionTitles, "PAYABLE");
  const realizedReceipts = overview.currentSettlements.filter((entry) => entry.titleType === "RECEIVABLE");
  const realizedPayments = overview.currentSettlements.filter((entry) => entry.titleType === "PAYABLE");
  const cashProjectionSeries = overview.cashProjectionSeries.map((point) => ({
    date: point.date,
    projected: Number(point.projectedBalanceCents) / 100,
    withoutOverdue: Number(point.withoutOverdueReceivablesCents) / 100,
  }));
  const selectedAccount = selected.conta ? overview.accounts.find((account) => account.id === selected.conta) : undefined;
  const alerts = [
    overduePayables.items.length > 0 ? { tone: "danger", title: "Contas a pagar vencidas", body: `${overduePayables.items.length} ${overduePayables.items.length === 1 ? "obrigação vencida soma" : "obrigações vencidas somam"} ${formatCents(overduePayables.totalCents)}.`, href: "/relatorios/em-aberto", action: "Ver contas" } : null,
    overdueReceivables.items.length > 0 ? { tone: "warning", title: "Recebíveis vencidos", body: `${overdueReceivables.items.length} ${overdueReceivables.items.length === 1 ? "recebível vencido soma" : "recebíveis vencidos somam"} ${formatCents(overdueReceivables.totalCents)}.${segmentedView ? "" : " A projeção depende da cobrança desses valores."}`, href: "/relatorios/em-aberto", action: "Ver cobranças" } : null,
    !segmentedView && overview.firstNegativeDate ? { tone: "danger", title: "Risco de caixa negativo", body: `Mesmo recebendo os vencidos, a projeção cruza zero em ${formatDateOnly(overview.firstNegativeDate)}.`, href: "/relatorios/fluxo-de-caixa", action: "Ver fluxo" } : null,
    !segmentedView && !overview.firstNegativeDate && overview.firstNegativeWithoutOverdueDate ? { tone: "warning", title: "Risco sem receber atrasados", body: `Sem receber os títulos vencidos, o caixa cruza zero em ${formatDateOnly(overview.firstNegativeWithoutOverdueDate)}.`, href: "/relatorios/fluxo-de-caixa", action: "Ver fluxo" } : null,
    overview.reconciliation.available && overview.reconciliation.pendingCount > 0 ? { tone: "warning", title: "Conciliação pendente", body: `${overview.reconciliation.pendingCount} ${overview.reconciliation.pendingCount === 1 ? "linha aguarda" : "linhas aguardam"} conferência, somando ${formatCents(overview.reconciliation.pendingAmountCents)}${overview.reconciliation.oldestPendingDate ? `, desde ${formatDateOnly(overview.reconciliation.oldestPendingDate)}` : ""}.`, href: selected.conta ? `/conciliacao?conta=${selected.conta}` : "/conciliacao", action: "Conciliar" } : null,
    overview.reconciliation.available && overview.reconciliation.failedImportCount > 0 ? { tone: "danger", title: "Importação com falha", body: `${overview.reconciliation.failedImportCount} ${overview.reconciliation.failedImportCount === 1 ? "importação precisa" : "importações precisam"} de atenção.`, href: "/conciliacao", action: "Diagnosticar" } : null,
  ].filter((alert): alert is NonNullable<typeof alert> => Boolean(alert));

  return (
    <main className="wide dashboard-page">
      <h1 className="sr-only">Dashboard financeiro</h1>
      <DashboardFilters companyId={activeCompanyId} accounts={activeAccounts.map(({ id, name }) => ({ id, name }))}
        categories={sortCategoriesTree(categories).map(({ id, name, parentId }) => ({ id, name: parentId ? `↳ ${name}` : name }))}
        parties={parties.map(({ id, name }) => ({ id, name }))} costCenters={costCenters.map(({ id, name }) => ({ id, name }))} values={selected}
        actions={(
          <div className="quick-actions">
            <QuickCreateButton kind="RECEIVABLE" className="quick-action-card revenue"><span className="quick-action-icon"><ArrowDownCircle className="size-[18px]" strokeWidth={1.7} /></span>Nova receita</QuickCreateButton>
            <QuickCreateButton kind="PAYABLE" className="quick-action-card expense"><span className="quick-action-icon"><ArrowUpCircle className="size-[18px]" strokeWidth={1.7} /></span>Nova despesa</QuickCreateButton>
          </div>
        )} />
      <Reveal className="stat-grid dashboard-primary-grid">
        <StatCard prominent icon={<Wallet className="size-5" />} label={selected.conta ? "Saldo da conta" : "Disponível na empresa"} value={formatCents(selectedAccount?.currentBalanceCents ?? overview.availableBalanceCents)} footerLabel={selected.conta ? "Incluída no total" : "Contas incluídas"} footerValue={selected.conta ? (selectedAccount?.includedInAvailableTotal ? "Sim" : "Não") : String(overview.accounts.filter((account) => account.includedInAvailableTotal).length)} gradient="blue" modalTitle="Saldo por conta">
          {overview.accounts.length === 0 ? <p className="muted">Nenhuma conta disponível.</p> : <table className="dashboard-detail-table"><thead><tr><th>Conta</th><th>Tipo</th><th>Saldo</th></tr></thead><tbody>{overview.accounts.map((account) => <tr key={account.id}><td data-label="Conta">{account.name}</td><td data-label="Tipo">{ACCOUNT_TYPE_LABEL[account.type] ?? account.type}</td><td data-label="Saldo">{formatCents(account.currentBalanceCents, account.currency)}</td></tr>)}</tbody></table>}
        </StatCard>
        {segmentedView ? (
          <div className="dashboard-projection-unavailable"><Landmark className="size-5" /><strong>Projeção no consolidado</strong><p>{selected.conta ? "Os títulos em aberto não têm conta de destino definida." : "O saldo inicial é da empresa inteira, enquanto os títulos foram filtrados."} Limpe os filtros para ver uma projeção com o mesmo escopo.</p></div>
        ) : (
          <StatCard icon={<Landmark className="size-5" />} label="Projetado em 30 dias" value={formatCents(overview.projectedBalanceCents)} footerLabel="Sem receber vencidos" footerValue={formatCents(overview.balanceWithoutOverdueReceivablesCents)} gradient={overview.projectedBalanceCents < BigInt(0) ? "pink" : "blue"} modalTitle="Cenários para os próximos 30 dias">
            <p className="muted">O valor principal supõe que todos os títulos em aberto sejam pagos na data de vencimento. Recebíveis já vencidos entram hoje; o cenário alternativo os exclui. Nenhum dos dois é garantia de recebimento.</p>
            <TitleDetailList titles={overview.projectionTitles} />
          </StatCard>
        )}
        {selected.conta ? <div className="dashboard-projection-unavailable dashboard-open-titles-unavailable"><strong>Títulos sem conta atribuída</strong><p>Os valores a pagar e a receber são da empresa e não podem ser atribuídos à conta selecionada.</p></div> : <>
          <StatCard icon={<ArrowUpCircle className="size-5" />} label={`A pagar até ${formatDateOnly(overview.projectionEnd)}`} value={formatCents(projectionPayables.totalCents)} footerLabel="Vencidos" footerValue={String(overduePayables.items.length)} gradient="orange" modalTitle="Obrigações até o fim da projeção"><TitleDetailList titles={projectionPayables.items} /></StatCard>
          <StatCard icon={<ArrowDownCircle className="size-5" />} label={`A receber até ${formatDateOnly(overview.projectionEnd)}`} value={formatCents(projectionReceivables.totalCents)} footerLabel="Vencidos" footerValue={String(overdueReceivables.items.length)} gradient="teal" modalTitle="Recebíveis até o fim da projeção"><TitleDetailList titles={projectionReceivables.items} /></StatCard>
        </>}
      </Reveal>

      <section className="card dashboard-alerts">
        <div className="dashboard-section-heading"><div><h2>O que precisa de atenção</h2><p>{selected.conta ? "Pendências da empresa; títulos ainda não podem ser atribuídos à conta selecionada." : "Prioridades da empresa, com valores a pagar e a receber separados."}</p></div><span>{alerts.length} {alerts.length === 1 ? "pendência" : "pendências"}</span></div>
        {alerts.length === 0 ? <div className="dashboard-alert success"><CircleCheck className="size-5" /><div><strong>Nenhuma pendência detectada</strong><p>Não há atrasos, importações com falha ou conciliações pendentes neste escopo.</p></div></div>
          : <div className="dashboard-alert-list">{alerts.map((alert) => <div key={alert.title} className={`dashboard-alert ${alert.tone}`}><AlertTriangle className="size-5" /><div><strong>{alert.title}</strong><p>{alert.body}</p></div><Link href={alert.href}>{alert.action}</Link></div>)}</div>}
      </section>

      {!segmentedView ? (
        <section className="card dashboard-projection-section">
          <div className="dashboard-section-heading"><div><h2>Caminho do caixa · próximos 30 dias</h2><p>Saldo acumulado após os compromissos de cada dia. A linha tracejada exclui recebíveis já vencidos.</p></div></div>
          <CashProjectionChart data={cashProjectionSeries} />
          <div className="dashboard-projection-legend"><span><i className="is-full" />Todos os recebíveis</span><span><i className="is-without-overdue" />Sem receber vencidos</span></div>
          <p className="dashboard-projection-note">As duas linhas consideram pagamentos e recebimentos futuros nas datas cadastradas. Confira os vencidos antes de usar a projeção para decidir pagamentos.</p>
        </section>
      ) : null}

      <section className="dashboard-period-section">
        <div className="dashboard-section-heading"><div><h2>No período selecionado</h2><p>{selected.conta ? "Movimentos realizados na conta selecionada. Títulos em aberto não têm conta atribuída." : "Movimentos realizados e títulos abertos com vencimento no período."}</p></div></div>
        <Reveal className="stat-grid dashboard-secondary-grid">
        <StatCard icon={<ArrowDownCircle className="size-5" />} label="Recebimentos realizados" value={formatCents(overview.current.receivedCents)} footerLabel="Baixas no período" footerValue={String(realizedReceipts.length)} comparisonLabel={comparison ? `vs. ${comparison.label.toLowerCase()}` : undefined} comparisonValue={overview.comparison ? comparisonValue(overview.current.receivedCents, overview.comparison.receivedCents) : undefined} gradient="teal" modalTitle="Recebimentos realizados"><SettlementList entries={realizedReceipts} /></StatCard>
        <StatCard icon={<ArrowUpCircle className="size-5" />} label="Pagamentos realizados" value={formatCents(overview.current.paidCents)} footerLabel="Baixas no período" footerValue={String(realizedPayments.length)} comparisonLabel={comparison ? `vs. ${comparison.label.toLowerCase()}` : undefined} comparisonValue={overview.comparison ? comparisonValue(overview.current.paidCents, overview.comparison.paidCents) : undefined} gradient="pink" modalTitle="Pagamentos realizados"><SettlementList entries={realizedPayments} /></StatCard>
        <StatCard icon={<TrendingUp className="size-5" />} label="Geração líquida operacional" value={formatCents(overview.current.operatingNetCents)} footerLabel="Recebido − pago" footerValue={`${formatCents(overview.current.operatingReceivedCents)} − ${formatCents(overview.current.operatingPaidCents)}`} comparisonLabel={comparison ? `vs. ${comparison.label.toLowerCase()}` : undefined} comparisonValue={overview.comparison ? comparisonValue(overview.current.operatingNetCents, overview.comparison.operatingNetCents) : undefined} gradient="blue" modalTitle="Geração operacional"><p>Recebimentos operacionais: <strong>{formatCents(overview.current.operatingReceivedCents)}</strong></p><p>Pagamentos operacionais: <strong>{formatCents(overview.current.operatingPaidCents)}</strong></p><p className="muted">Financiamentos, patrimônio, investimentos e transferências técnicas não inflam este indicador.</p></StatCard>
        {!selected.conta ? <>
          <StatCard icon={<ArrowDownCircle className="size-5" />} label="A receber no período" value={formatCents(currentReceivables.totalCents)} footerLabel="Títulos abertos" footerValue={String(currentReceivables.items.length)} comparisonLabel={comparison ? `vs. ${comparison.label.toLowerCase()}` : undefined} comparisonValue={overview.comparison ? comparisonValue(currentReceivables.totalCents, previousReceivables.totalCents) : undefined} gradient="teal" modalTitle="A receber no período"><TitleDetailList titles={currentReceivables.items} /></StatCard>
          <StatCard icon={<ArrowUpCircle className="size-5" />} label="A pagar no período" value={formatCents(currentPayables.totalCents)} footerLabel="Títulos abertos" footerValue={String(currentPayables.items.length)} comparisonLabel={comparison ? `vs. ${comparison.label.toLowerCase()}` : undefined} comparisonValue={overview.comparison ? comparisonValue(currentPayables.totalCents, previousPayables.totalCents) : undefined} gradient="orange" modalTitle="A pagar no período"><TitleDetailList titles={currentPayables.items} /></StatCard>
        </> : null}
        </Reveal>
      </section>

      <section className="card dashboard-category-section"><h2>Movimento por categoria</h2><p className="subtitle">Entradas e saídas realizadas no período, ordenadas pelo valor absoluto.</p><CategoryRanking ranking={overview.categoryRanking} /></section>
    </main>
  );
}
