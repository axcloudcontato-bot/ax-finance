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
import { filterCategoriesByTitleType, sortCategoriesTree } from "@/lib/categories";
import { Reveal } from "@/components/gsap/reveal";
import { StatCard } from "@/components/dashboard/stat-card";
import { TitleDetailList } from "@/components/dashboard/title-detail-list";
import { RealizedForecastChart } from "@/components/dashboard/realized-forecast-chart";
import { DashboardFilters } from "@/components/dashboard/dashboard-filters";
import { Modal } from "@/components/ui/modal";
import { TitleForm } from "@/components/titles/title-form";
import { createEntradaAction, createEntradaAndContinueAction } from "../entradas/actions";
import { createSaidaAction, createSaidaAndContinueAction } from "../saidas/actions";

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
    <table>
      <thead><tr><th>Data</th><th>Título</th><th>Conta</th><th>Valor em caixa</th></tr></thead>
      <tbody>{entries.map((entry) => (
        <tr key={entry.id}>
          <td>{formatDateOnly(entry.effectiveDate)}</td>
          <td><Link href={entry.titleType === "RECEIVABLE" ? `/entradas/${entry.titleId}` : `/saidas/${entry.titleId}`}>{entry.titleDescription}</Link></td>
          <td>{entry.accountName}</td>
          <td>{formatCents(entry.cashDeltaCents < BigInt(0) ? -entry.cashDeltaCents : entry.cashDeltaCents)}</td>
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
  const overdueTotalCents = overview.overdueTitles.reduce((sum, title) => sum + title.remainingCents, BigInt(0));
  const realizedReceipts = overview.currentSettlements.filter((entry) => entry.titleType === "RECEIVABLE");
  const realizedPayments = overview.currentSettlements.filter((entry) => entry.titleType === "PAYABLE");
  const flowSeries = overview.flowSeries.map((point) => ({
    label: point.label,
    recebimentosRealizados: Number(point.realizedReceiptsCents) / 100,
    pagamentosRealizados: Number(point.realizedPaymentsCents) / 100,
    recebimentosPrevistos: Number(point.forecastReceiptsCents) / 100,
    pagamentosPrevistos: Number(point.forecastPaymentsCents) / 100,
  }));
  const alerts = [
    overview.firstNegativeDate ? { tone: "danger", title: "Risco de caixa negativo", body: `A projeção cruza zero em ${formatDateOnly(overview.firstNegativeDate)}. Revise os compromissos dos próximos 30 dias.`, href: "/relatorios/fluxo-de-caixa", action: "Ver fluxo" } : null,
    overview.reconciliation.available && overview.reconciliation.pendingCount > 0 ? { tone: "warning", title: "Conciliação pendente", body: `${overview.reconciliation.pendingCount} linha(s), somando ${formatCents(overview.reconciliation.pendingAmountCents)}, aguardam conferência${overview.reconciliation.oldestPendingDate ? ` desde ${formatDateOnly(overview.reconciliation.oldestPendingDate)}` : ""}.`, href: selected.conta ? `/conciliacao?conta=${selected.conta}` : "/conciliacao", action: "Conciliar" } : null,
    overview.reconciliation.available && overview.reconciliation.failedImportCount > 0 ? { tone: "danger", title: "Importação com falha", body: `${overview.reconciliation.failedImportCount} importação(ões) precisa(m) de atenção.`, href: "/conciliacao", action: "Diagnosticar" } : null,
    overview.overdueTitles.length > 0 ? { tone: "warning", title: "Títulos vencidos", body: `${overview.overdueTitles.length} título(s) em aberto somam ${formatCents(overdueTotalCents)}.`, href: "/relatorios/em-aberto", action: "Ver vencidos" } : null,
  ].filter((alert): alert is NonNullable<typeof alert> => Boolean(alert));
  const clients = parties.filter((party) => party.isClient);
  const suppliers = parties.filter((party) => party.isSupplier);

  return (
    <main className="wide dashboard-page">
      <DashboardFilters companyId={activeCompanyId} accounts={activeAccounts.map(({ id, name }) => ({ id, name }))}
        categories={sortCategoriesTree(categories).map(({ id, name, parentId }) => ({ id, name: parentId ? `↳ ${name}` : name }))}
        parties={parties.map(({ id, name }) => ({ id, name }))} costCenters={costCenters.map(({ id, name }) => ({ id, name }))} values={selected}
        actions={(
          <div className="quick-actions">
            <Modal triggerLabel={<><span className="quick-action-icon"><ArrowDownCircle className="size-[18px]" strokeWidth={1.7} /></span>Nova receita</>} triggerClassName="quick-action-card revenue" title="Nova entrada" icon={<ArrowDownCircle className="size-5" strokeWidth={1.5} />} maxWidth="720px">
              <TitleForm action={createEntradaAction} actionAndContinue={createEntradaAndContinueAction} categories={sortCategoriesTree(filterCategoriesByTitleType(categories, "RECEIVABLE"))} parties={clients} costCenters={costCenters} partyLabel="Cliente" />
            </Modal>
            <Modal triggerLabel={<><span className="quick-action-icon"><ArrowUpCircle className="size-[18px]" strokeWidth={1.7} /></span>Nova despesa</>} triggerClassName="quick-action-card expense" title="Nova saída" icon={<ArrowUpCircle className="size-5" strokeWidth={1.5} />} maxWidth="720px">
              <TitleForm action={createSaidaAction} actionAndContinue={createSaidaAndContinueAction} categories={sortCategoriesTree(filterCategoriesByTitleType(categories, "PAYABLE"))} parties={suppliers} costCenters={costCenters} partyLabel="Fornecedor" />
            </Modal>
          </div>
        )} />

      <Reveal className="stat-grid dashboard-stat-grid">
        <StatCard icon={<Wallet className="size-5" />} label="Saldo disponível (hoje)" value={formatCents(overview.availableBalanceCents)} footerLabel={selected.conta ? "Conta selecionada" : "Contas incluídas"} footerValue={String(overview.accounts.filter((account) => account.includedInAvailableTotal).length)} gradient="blue" modalTitle="Saldo por conta">
          {overview.accounts.length === 0 ? <p className="muted">Nenhuma conta disponível.</p> : <table><thead><tr><th>Conta</th><th>Tipo</th><th>Saldo</th></tr></thead><tbody>{overview.accounts.map((account) => <tr key={account.id}><td>{account.name}</td><td>{ACCOUNT_TYPE_LABEL[account.type] ?? account.type}</td><td>{formatCents(account.currentBalanceCents, account.currency)}</td></tr>)}</tbody></table>}
        </StatCard>
        <StatCard icon={<ArrowDownCircle className="size-5" />} label="Recebimentos realizados" value={formatCents(overview.current.receivedCents)} footerLabel="Baixas no período" footerValue={String(realizedReceipts.length)} comparisonLabel={comparison ? `vs. ${comparison.label.toLowerCase()}` : undefined} comparisonValue={overview.comparison ? comparisonValue(overview.current.receivedCents, overview.comparison.receivedCents) : undefined} gradient="teal" modalTitle="Recebimentos realizados"><SettlementList entries={realizedReceipts} /></StatCard>
        <StatCard icon={<ArrowUpCircle className="size-5" />} label="Pagamentos realizados" value={formatCents(overview.current.paidCents)} footerLabel="Baixas no período" footerValue={String(realizedPayments.length)} comparisonLabel={comparison ? `vs. ${comparison.label.toLowerCase()}` : undefined} comparisonValue={overview.comparison ? comparisonValue(overview.current.paidCents, overview.comparison.paidCents) : undefined} gradient="pink" modalTitle="Pagamentos realizados"><SettlementList entries={realizedPayments} /></StatCard>
        <StatCard icon={<TrendingUp className="size-5" />} label="Geração líquida operacional" value={formatCents(overview.current.operatingNetCents)} footerLabel="Recebido − pago" footerValue={`${formatCents(overview.current.operatingReceivedCents)} − ${formatCents(overview.current.operatingPaidCents)}`} comparisonLabel={comparison ? `vs. ${comparison.label.toLowerCase()}` : undefined} comparisonValue={overview.comparison ? comparisonValue(overview.current.operatingNetCents, overview.comparison.operatingNetCents) : undefined} gradient="blue" modalTitle="Geração operacional"><p>Recebimentos operacionais: <strong>{formatCents(overview.current.operatingReceivedCents)}</strong></p><p>Pagamentos operacionais: <strong>{formatCents(overview.current.operatingPaidCents)}</strong></p><p className="muted">Financiamentos, patrimônio, investimentos e transferências técnicas não inflam este indicador.</p></StatCard>
        <StatCard icon={<ArrowDownCircle className="size-5" />} label="A receber no período" value={formatCents(currentReceivables.totalCents)} footerLabel="Títulos abertos" footerValue={String(currentReceivables.items.length)} comparisonLabel={comparison ? `vs. ${comparison.label.toLowerCase()}` : undefined} comparisonValue={overview.comparison ? comparisonValue(currentReceivables.totalCents, previousReceivables.totalCents) : undefined} gradient="teal" modalTitle="A receber no período"><TitleDetailList titles={currentReceivables.items} /></StatCard>
        <StatCard icon={<ArrowUpCircle className="size-5" />} label="A pagar no período" value={formatCents(currentPayables.totalCents)} footerLabel="Títulos abertos" footerValue={String(currentPayables.items.length)} comparisonLabel={comparison ? `vs. ${comparison.label.toLowerCase()}` : undefined} comparisonValue={overview.comparison ? comparisonValue(currentPayables.totalCents, previousPayables.totalCents) : undefined} gradient="orange" modalTitle="A pagar no período"><TitleDetailList titles={currentPayables.items} /></StatCard>
        <StatCard icon={<AlertTriangle className="size-5" />} label="Recebíveis e obrigações vencidos" value={formatCents(overdueTotalCents)} footerLabel="Títulos vencidos" footerValue={String(overview.overdueTitles.length)} gradient="pink" modalTitle="Títulos vencidos"><TitleDetailList titles={overview.overdueTitles} /></StatCard>
        <StatCard icon={<Landmark className="size-5" />} label="Saldo projetado em 30 dias" value={formatCents(overview.projectedBalanceCents)} footerLabel={`Posição em ${formatDateOnly(overview.projectionEnd)}`} footerValue={`${overview.projectionTitles.length} compromisso(s)`} gradient={overview.projectedBalanceCents < BigInt(0) ? "pink" : "blue"} modalTitle="Projeção dos próximos 30 dias"><p className="muted">Saldo atual + entradas previstas − saídas previstas.</p><TitleDetailList titles={overview.projectionTitles} /></StatCard>
      </Reveal>

      <Reveal className="dashboard-analysis-grid">
        <section className="card dashboard-flow-card"><h1>Fluxo realizado versus previsto</h1><p className="subtitle">Linhas contínuas são baixas efetivas; linhas tracejadas são saldos abertos na data de vencimento.</p><RealizedForecastChart data={flowSeries} /></section>
        <section className="card"><h1>Ranking por categoria</h1><p className="subtitle">Movimento de caixa realizado no período; saídas aparecem negativas.</p><CategoryRanking ranking={overview.categoryRanking} /></section>
      </Reveal>

      <section className="card dashboard-alerts">
        <div className="page-header"><div><h1>Alertas e pendências</h1><p className="subtitle">Sinais determinísticos com origem e ação recomendada.</p></div></div>
        {alerts.length === 0 ? <div className="dashboard-alert success"><CircleCheck className="size-5" /><div><strong>Nenhuma pendência crítica</strong><p>Caixa projetado não cruza zero e não há conciliações, importações com falha ou títulos vencidos neste escopo.</p></div></div>
          : <div className="dashboard-alert-list">{alerts.map((alert) => <div key={alert.title} className={`dashboard-alert ${alert.tone}`}><AlertTriangle className="size-5" /><div><strong>{alert.title}</strong><p>{alert.body}</p></div><Link href={alert.href}>{alert.action}</Link></div>)}</div>}
      </section>
    </main>
  );
}
