import { redirect } from "next/navigation";
import { getManagerialIncomeStatement } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { formatCents } from "@/lib/currency";
import { formatDateOnly } from "@/lib/dates";
import { resolveComparison, resolvePeriodRange } from "@/lib/month";
import { formatPercentageChange } from "@/lib/comparison";
import { requirePlanFeature } from "@/lib/plan-access";

type Line = { label: string; cents: bigint };

/** Junta o período atual e o de comparação pelo rótulo, mantendo as linhas que só existem em um deles. */
function merge(current: Line[], previous: Line[] | undefined) {
  const now = new Map(current.map((line) => [line.label, line.cents]));
  const before = new Map((previous ?? []).map((line) => [line.label, line.cents]));
  return [...new Set([...now.keys(), ...before.keys()])].map((label) => ({
    label,
    current: now.get(label) ?? BigInt(0),
    previous: before.get(label) ?? BigInt(0),
  }));
}

export default async function DrePage(
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
  await requirePlanFeature(user.id, company.id, "MANAGERIAL_DRE");

  const period = resolvePeriodRange(searchParams);
  const { from, to } = period;
  const comparison = resolveComparison(searchParams, period);

  const [report, comparisonReport] = await Promise.all([
    getManagerialIncomeStatement(user.id, company.id, { from, to }),
    comparison ? getManagerialIncomeStatement(user.id, company.id, comparison) : Promise.resolve(null),
  ]);
  const exportHref = `/api/reports/dre?de=${from}&ate=${to}`;
  const compared = Boolean(comparisonReport);
  const zero = BigInt(0);

  const sections = [
    {
      title: "Resultado operacional",
      note: "Receitas, custos e despesas por competência.",
      rows: merge(report.groups, comparisonReport?.groups),
      total: { label: "Resultado operacional", current: report.operatingResultCents, previous: comparisonReport?.operatingResultCents ?? zero },
      empty: "Sem receitas, custos ou despesas neste período.",
    },
    {
      title: "Resultado financeiro",
      note: "Juros, multas, tarifas e descontos, pela data em que foram pagos ou recebidos.",
      rows: merge(report.financialLines, comparisonReport?.financialLines),
      total: { label: "Resultado financeiro", current: report.financialResultCents, previous: comparisonReport?.financialResultCents ?? zero },
      empty: "Sem juros, tarifas ou descontos neste período.",
    },
  ];
  const outsideRows = merge(report.outsideResult, comparisonReport?.outsideResult);
  const lineCount = sections.reduce((count, section) => count + section.rows.length, 0);

  return (
    <main className="wide">
      <div className="page-header"><h1>DRE gerencial</h1><a href={exportHref} className="button-link">Exportar CSV</a></div>
      <p className="muted" style={{ marginBottom: "1rem" }}>
        {company.name} · {formatDateOnly(from)} a {formatDateOnly(to)} · regime de competência ·
        gerado em {new Date().toLocaleString("pt-BR")}
      </p>
      {comparison ? (
        <p className="comparison-banner">
          Comparando com {comparison.label.toLowerCase()}: {formatDateOnly(comparison.from)} a {formatDateOnly(comparison.to)}.
        </p>
      ) : null}

      <section className="workspace-metrics" aria-label="Resumo da DRE gerencial">
        <div className="workspace-metric workspace-metric-primary"><span className="workspace-metric-label">Resultado do período</span><strong>{formatCents(report.totalCents)}</strong><span className="workspace-metric-detail">Operacional mais financeiro</span></div>
        <div className="workspace-metric"><span className="workspace-metric-label">Resultado operacional</span><strong>{formatCents(report.operatingResultCents)}</strong><span className="workspace-metric-detail">{lineCount} {lineCount === 1 ? "linha" : "linhas"} no período</span></div>
        <div className="workspace-metric"><span className="workspace-metric-label">Resultado financeiro</span><strong>{formatCents(report.financialResultCents)}</strong><span className="workspace-metric-detail">Juros, tarifas e descontos</span></div>
      </section>
      <details className="workspace-method-note"><summary>Como este resultado é calculado</summary><p>O resultado operacional usa a competência e o valor original dos títulos, inclusive os ainda em aberto; títulos cancelados ficam fora, e as compras no cartão entram pela própria categoria. O resultado financeiro soma juros, multas, tarifas e descontos pela data da baixa. Investimento, financiamento e patrimônio (aportes, retiradas, amortização de empréstimo, compra de equipamento) mexem no caixa e não no lucro: aparecem abaixo, só para conferência, fora do total.</p></details>

      {sections.map((section) => (
        <div className="card" key={section.title}>
          <div className="workspace-card-heading"><div><h2>{section.title}</h2><p>{section.note}</p></div></div>
          {section.rows.length === 0 ? (
            <div className="workspace-empty"><strong>{section.empty}</strong><p>Altere o período acima para analisar outra competência.</p></div>
          ) : (
            <div className="table-scroll"><table className="workspace-table">
              <thead>
                <tr>
                  <th>Grupo</th>
                  <th className="money">Período atual</th>
                  {compared ? <><th className="money">{comparison?.label}</th><th className="money">Variação</th></> : null}
                </tr>
              </thead>
              <tbody>
                {section.rows.map((row) => (
                  <tr key={row.label}>
                    <td>{row.label}</td>
                    <td className="money">{formatCents(row.current)}</td>
                    {compared ? <><td className="money">{formatCents(row.previous)}</td><td className="money">{formatPercentageChange(row.current, row.previous)}</td></> : null}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td style={{ fontWeight: 700 }}>{section.total.label}</td>
                  <td className="money" style={{ fontWeight: 700 }}>{formatCents(section.total.current)}</td>
                  {compared ? <><td className="money" style={{ fontWeight: 700 }}>{formatCents(section.total.previous)}</td><td className="money" style={{ fontWeight: 700 }}>{formatPercentageChange(section.total.current, section.total.previous)}</td></> : null}
                </tr>
              </tfoot>
            </table></div>
          )}
        </div>
      ))}

      <div className="card">
        <div className="workspace-card-heading"><div><h2>Fora do resultado</h2><p>Movimentação de capital, só para conferência. Não entra no resultado do período.</p></div></div>
        {outsideRows.length === 0 ? (
          <div className="workspace-empty"><strong>Nenhuma movimentação de capital neste período</strong></div>
        ) : (
          <div className="table-scroll"><table className="workspace-table">
            <thead>
              <tr>
                <th>Grupo</th>
                <th className="money">Período atual</th>
                {compared ? <th className="money">{comparison?.label}</th> : null}
              </tr>
            </thead>
            <tbody>
              {outsideRows.map((row) => (
                <tr key={row.label}>
                  <td>{row.label}</td>
                  <td className="money">{formatCents(row.current)}</td>
                  {compared ? <td className="money">{formatCents(row.previous)}</td> : null}
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>
    </main>
  );
}
