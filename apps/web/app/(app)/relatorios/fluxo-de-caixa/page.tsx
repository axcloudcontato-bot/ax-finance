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
      <h1 style={{ marginBottom: "0.25rem" }}>Fluxo de caixa realizado</h1>
      <p className="muted" style={{ marginBottom: "1rem" }}>
        {company.name} · {formatDateOnly(from)} a {formatDateOnly(to)} · gerado em{" "}
        {new Date().toLocaleString("pt-BR")}
      </p>
      {comparison ? (
        <p className="comparison-banner">
          Comparando com {comparison.label.toLowerCase()}: {formatDateOnly(comparison.from)} a {formatDateOnly(comparison.to)}.
        </p>
      ) : null}

      <div className="card">
        <form method="get" style={{ display: "flex", gap: "1rem", alignItems: "flex-end", flexWrap: "wrap" }}>
          {comparison ? <input type="hidden" name="comparar" value={comparison.mode} /> : null}
          <div>
            <label htmlFor="de">De</label>
            <input id="de" name="de" type="date" defaultValue={from} />
          </div>
          <div>
            <label htmlFor="ate">Até</label>
            <input id="ate" name="ate" type="date" defaultValue={to} />
          </div>
          <button type="submit" style={{ marginTop: 0 }}>
            Filtrar intervalo customizado
          </button>
          <a href={exportHref} className="button-link">
            Exportar CSV
          </a>
        </form>
      </div>

      <div className="card">
        <h1>Por natureza</h1>
        {natureRows.length === 0 ? (
          <p className="muted">Nenhuma baixa no período.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Natureza</th>
                <th>Período atual</th>
                {comparisonReport ? <><th>{comparison?.label}</th><th>Variação</th></> : null}
              </tr>
            </thead>
            <tbody>
              {natureRows.map((row) => (
                <tr key={row.nature}>
                  <td>{NATURE_LABEL[row.nature] ?? row.nature}</td>
                  <td>{formatCents(row.current)}</td>
                  {comparisonReport ? <><td>{formatCents(row.previous)}</td><td>{formatPercentageChange(row.current, row.previous)}</td></> : null}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td style={{ fontWeight: 700 }}>Total</td>
                <td style={{ fontWeight: 700 }}>{formatCents(report.totalCents)}</td>
                {comparisonReport ? <><td style={{ fontWeight: 700 }}>{formatCents(comparisonReport.totalCents)}</td><td style={{ fontWeight: 700 }}>{formatPercentageChange(report.totalCents, comparisonReport.totalCents)}</td></> : null}
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      <div className="card">
        <h1>Baixas do período</h1>
        {report.entries.length === 0 ? (
          <p className="muted">Nenhuma baixa no período.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Tipo</th>
                <th>Descrição</th>
                <th>Categoria</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              {report.entries.map((entry) => (
                <tr key={entry.settlementId}>
                  <td>{formatDateOnly(entry.effectiveDate)}</td>
                  <td>{entry.titleType === "RECEIVABLE" ? "Entrada" : "Saída"}</td>
                  <td>{entry.titleDescription}</td>
                  <td>{entry.categoryName}</td>
                  <td>{formatCents(entry.cashDeltaCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
