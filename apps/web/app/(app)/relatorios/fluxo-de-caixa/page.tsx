import { redirect } from "next/navigation";
import { getCashFlowReport } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { formatCents } from "@/lib/currency";
import { formatDateOnly } from "@/lib/dates";
import { NATURE_LABEL } from "@/lib/category-labels";
import { resolveComparison, resolvePeriodRange } from "@/lib/month";
import { formatPercentageChange } from "@/lib/comparison";

export default async function FluxoDeCaixaPage(
  props: {
    searchParams: Promise<{ de?: string; ate?: string; mes?: string; periodo?: string; comparar?: string }>;
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
  const comparison = resolveComparison(searchParams, period);

  const [report, comparisonReport] = await Promise.all([
    getCashFlowReport(user.id, company.id, { from, to }),
    comparison ? getCashFlowReport(user.id, company.id, comparison) : Promise.resolve(null),
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
    <main className="wide">
      <div className="page-header"><h1>Fluxo de caixa realizado</h1><a href={exportHref} className="button-link">Exportar CSV</a></div>
      <p className="muted" style={{ marginBottom: "1rem" }}>
        {company.name} · {formatDateOnly(from)} a {formatDateOnly(to)} · gerado em{" "}
        {new Date().toLocaleString("pt-BR")}
      </p>
      {comparison ? (
        <p className="comparison-banner">
          Comparando com {comparison.label.toLowerCase()}: {formatDateOnly(comparison.from)} a {formatDateOnly(comparison.to)}.
        </p>
      ) : null}

      <section className="workspace-metrics" aria-label="Resumo do fluxo de caixa realizado">
        <div className="workspace-metric"><span className="workspace-metric-label">Recebimentos</span><strong>{formatCents(receivedCents)}</strong><span className="workspace-metric-detail">Entradas efetivas no período</span></div>
        <div className="workspace-metric"><span className="workspace-metric-label">Pagamentos</span><strong>{formatCents(paidCents)}</strong><span className="workspace-metric-detail">Saídas efetivas no período</span></div>
        <div className="workspace-metric workspace-metric-primary"><span className="workspace-metric-label">Variação líquida</span><strong>{formatCents(report.totalCents)}</strong><span className="workspace-metric-detail">Recebimentos menos pagamentos</span></div>
      </section>

      <div className="card">
        <h2>Por natureza</h2>
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
        <h2>Baixas do período</h2>
          <div className="table-scroll"><table className="workspace-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Tipo</th>
                <th>Descrição</th>
                <th>Categoria</th>
                <th className="money">Valor</th>
              </tr>
            </thead>
            <tbody>
              {report.entries.map((entry) => (
                <tr key={entry.settlementId}>
                  <td>{formatDateOnly(entry.effectiveDate)}</td>
                  <td>{entry.titleType === "RECEIVABLE" ? "Entrada" : "Saída"}</td>
                  <td>{entry.titleDescription}</td>
                  <td>{entry.categoryName}</td>
                  <td className="money">{formatCents(entry.cashDeltaCents)}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
      </div> : null}
    </main>
  );
}
