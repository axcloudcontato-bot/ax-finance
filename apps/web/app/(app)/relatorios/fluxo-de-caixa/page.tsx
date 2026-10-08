import Link from "next/link";
import { redirect } from "next/navigation";
import { getCashFlowReport, getCashProjection, getCompanyToday } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { formatCents } from "@/lib/currency";
import { formatDateOnly } from "@/lib/dates";
import { NATURE_LABEL } from "@/lib/category-labels";
import { resolveComparison, resolvePeriodRange } from "@/lib/month";
import { formatPercentageChange } from "@/lib/comparison";
import { ReportNavigation } from "@/components/reports/report-navigation";
import { CashProjectionSection } from "@/components/reports/cash-projection-section";
import { alignRealizedComparison } from "@/lib/report-comparison";

export default async function FluxoDeCaixaPage(
  props: {
    searchParams: Promise<{ de?: string; ate?: string; mes?: string; periodo?: string; comparar?: string; dias?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const company = await requirePrimaryCompany(user.id);

  const period = resolvePeriodRange(searchParams);
  const { from, to } = period;
  const today = await getCompanyToday(user.id, company.id);
  const comparison = alignRealizedComparison(period, resolveComparison(searchParams, period), today);

  const [report, comparisonReport, projection] = await Promise.all([
    getCashFlowReport(user.id, company.id, { from, to }),
    comparison ? getCashFlowReport(user.id, company.id, comparison) : Promise.resolve(null),
    getCashProjection(user.id, company.id, { days: searchParams.dias === "60" ? 60 : searchParams.dias === "90" ? 90 : 30 }),
  ]);
  const exportHref = `/api/reports/cash-flow?de=${from}&ate=${to}`;
  const receivedCents = report.entries.reduce((sum, entry) => sum + (entry.cashDeltaCents > BigInt(0) ? entry.cashDeltaCents : BigInt(0)), BigInt(0));
  const paidCents = report.entries.reduce((sum, entry) => sum + (entry.cashDeltaCents < BigInt(0) ? -entry.cashDeltaCents : BigInt(0)), BigInt(0));
  const comparisonByNature = new Map(comparisonReport?.subtotalsByNature.map((row) => [row.nature, row.cents]) ?? []);
  const natureRows = [...new Set([
    ...report.subtotalsByNature.map((row) => row.nature),
    ...(comparisonReport?.subtotalsByNature.map((row) => row.nature) ?? []),
  ])].map((nature) => ({
    nature,
    current: report.subtotalsByNature.find((row) => row.nature === nature)?.cents ?? BigInt(0),
    previous: comparisonByNature.get(nature) ?? BigInt(0),
  }));

  return (
    <main className="wide reports-page">
      <ReportNavigation active="cash" from={from} to={to} comparison={searchParams.comparar} />
      <div className="page-header"><h1>Fluxo de caixa</h1><a href={exportHref} className="button-link">Exportar realizado CSV</a></div>
      <p className="muted" style={{ marginBottom: "1rem" }}>
        {company.name} · {formatDateOnly(from)} a {formatDateOnly(to)} · gerado em{" "}
        {new Date().toLocaleString("pt-BR", { timeZone: company.timezone })}
      </p>
      {comparison ? (
        <p className="comparison-banner">
          Comparando com {comparison.label.toLowerCase()}: {formatDateOnly(comparison.from)} a {formatDateOnly(comparison.to)}.
          {to > today ? " A comparação acompanha os dias decorridos da seleção, limitada ao fim do período anterior." : ""}
        </p>
      ) : null}

      <section className="workspace-metrics" aria-label="Resumo do fluxo de caixa realizado">
        <div className="workspace-metric"><span className="workspace-metric-label">Recebimentos</span><strong>{formatCents(receivedCents)}</strong><span className="workspace-metric-detail">Entradas efetivas no período</span></div>
        <div className="workspace-metric"><span className="workspace-metric-label">Pagamentos</span><strong>{formatCents(paidCents)}</strong><span className="workspace-metric-detail">Saídas efetivas no período</span></div>
        <div className="workspace-metric workspace-metric-primary"><span className="workspace-metric-label">Variação líquida</span><strong>{formatCents(report.totalCents)}</strong><span className="workspace-metric-detail">Recebimentos menos pagamentos</span></div>
      </section>
      {to > report.today ? <p className="report-notice">O realizado considera somente baixas efetivas até {formatDateOnly(report.today)}. Datas futuras da seleção pertencem ao planejamento; baixas cadastradas com data futura não entram no realizado.</p> : null}

      <div className="card">
        <h2>Conferência do saldo registrado</h2>
        <div className="report-balance-bridge">
          <div><span>Saldo em {formatDateOnly(report.openingBalanceDate)}</span><strong>{formatCents(report.openingBalanceCents)}</strong></div>
          <div><span>Baixas e devoluções</span><strong>{formatCents(report.totalCents)}</strong></div>
          <div><span>Outras alterações de saldo</span><strong>{formatCents(report.otherBalanceChangesCents)}</strong></div>
          <div><span>Saldo em {formatDateOnly(report.closingBalanceDate)}</span><strong>{formatCents(report.closingBalanceCents)}</strong></div>
        </div>
        {report.balanceDifferenceCents !== BigInt(0) ? <p className="report-notice report-notice-alert" role="alert">Há uma diferença de {formatCents(report.balanceDifferenceCents)} entre o saldo e os movimentos consultados. Os registros podem ter mudado durante a consulta; atualize o relatório e confira as contas antes de usar o saldo.</p> : null}
        <p className="report-caption">Saldo inicial + baixas e devoluções + outras alterações = saldo final. Inclui todas as contas cadastradas, inclusive arquivadas e fora do disponível. Outras alterações incluem saldos de abertura no período, ajustes manuais e tarifas de transferência. Transferências internas não geram receita. A conferência usa os registros vigentes e não substitui a conciliação bancária.</p>
        <Link href="/contas">Conferir contas e saldos</Link>
      </div>
      <CashProjectionSection report={projection} periodQuery={new URLSearchParams({ de: from, ate: to, ...(searchParams.comparar ? { comparar: searchParams.comparar } : {}) }).toString()} />

      <div className="card">
        <h2>Movimentação realizada por natureza</h2>
        {natureRows.length === 0 ? (
          <div className="workspace-empty"><strong>Sem movimentação realizada</strong><p>Altere o período acima para consultar baixas em outras datas.</p></div>
        ) : (
          <div className="table-scroll"><table className="workspace-table">
            <thead>
              <tr>
                <th>Natureza</th>
                <th className="money">Período atual</th>
                {comparisonReport ? <><th className="money">{comparison?.label}</th><th className="money">Variação</th></> : null}
              </tr>
            </thead>
            <tbody>
              {natureRows.map((row) => (
                <tr key={row.nature}>
                  <td>{NATURE_LABEL[row.nature] ?? row.nature}</td>
                  <td className="money">{formatCents(row.current)}</td>
                  {comparisonReport ? <><td className="money">{formatCents(row.previous)}</td><td className="money">{formatPercentageChange(row.current, row.previous)}</td></> : null}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td style={{ fontWeight: 700 }}>Total</td>
                <td className="money" style={{ fontWeight: 700 }}>{formatCents(report.totalCents)}</td>
                {comparisonReport ? <><td className="money" style={{ fontWeight: 700 }}>{formatCents(comparisonReport.totalCents)}</td><td className="money" style={{ fontWeight: 700 }}>{formatPercentageChange(report.totalCents, comparisonReport.totalCents)}</td></> : null}
              </tr>
            </tfoot>
          </table></div>
        )}
      </div>

      {report.entries.length > 0 ? <div className="card">
        <h2>Baixas e devoluções do período</h2>
          <div className="table-scroll"><table className="workspace-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Tipo</th>
                <th>Descrição</th>
                <th>Categoria</th>
                <th>Conta</th>
                <th className="money">Valor</th>
              </tr>
            </thead>
            <tbody>
              {report.entries.map((entry) => (
                <tr key={entry.id}>
                  <td>{formatDateOnly(entry.effectiveDate)}</td>
                  <td>{entry.cashDeltaCents >= BigInt(0) ? "Entrada" : "Saída"}{entry.kind === "REFUND" ? " · devolução" : ""}</td>
                  <td><Link href={`/${entry.titleType === "RECEIVABLE" ? "entradas" : "saidas"}/${entry.titleId}`}>{entry.titleDescription}</Link></td>
                  <td>{entry.categoryName}</td>
                  <td>{entry.accountName}</td>
                  <td className="money">{formatCents(entry.cashDeltaCents)}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
      </div> : null}
    </main>
  );
}
