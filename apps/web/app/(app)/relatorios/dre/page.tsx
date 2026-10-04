import { redirect } from "next/navigation";
import { getManagerialIncomeStatement } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { formatCents } from "@/lib/currency";
import { formatDateOnly } from "@/lib/dates";
import { resolveComparison, resolvePeriodRange } from "@/lib/month";
import { formatPercentageChange } from "@/lib/comparison";
import { requirePlanFeature } from "@/lib/plan-access";

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
  const currentByGroup = new Map(report.groups.map((group) => [group.label, group.cents]));
  const comparisonByGroup = new Map(comparisonReport?.groups.map((group) => [group.label, group.cents]) ?? []);
  const groupRows = [...new Set([...currentByGroup.keys(), ...comparisonByGroup.keys()])].map((label) => ({
    label,
    current: currentByGroup.get(label) ?? BigInt(0),
    previous: comparisonByGroup.get(label) ?? BigInt(0),
  }));

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

      <section className="workspace-metrics workspace-metrics-two" aria-label="Resumo da DRE gerencial">
        <div className="workspace-metric workspace-metric-primary"><span className="workspace-metric-label">Resultado gerencial</span><strong>{formatCents(report.totalCents)}</strong><span className="workspace-metric-detail">Regime de competência no período</span></div>
        <div className="workspace-metric"><span className="workspace-metric-label">Grupos apresentados</span><strong>{groupRows.length}</strong><span className="workspace-metric-detail">Categorias agrupadas por gestão</span></div>
      </section>
      <details className="workspace-method-note"><summary>Como este resultado é calculado</summary><p>Considera a competência e o valor original dos títulos, inclusive os ainda em aberto. Títulos cancelados ficam fora. Categorias sem grupo gerencial são agrupadas pela natureza.</p></details>

      <div className="card">
        <h2>Por grupo gerencial</h2>
        {groupRows.length === 0 ? (
          <div className="workspace-empty"><strong>Sem títulos neste período</strong><p>Altere o período acima para analisar outra competência.</p></div>
        ) : (
          <div className="table-scroll"><table className="workspace-table">
            <thead>
              <tr>
                <th>Grupo</th>
                <th className="money">Período atual</th>
                {comparisonReport ? <><th className="money">{comparison?.label}</th><th className="money">Variação</th></> : null}
              </tr>
            </thead>
            <tbody>
              {groupRows.map((group) => (
                <tr key={group.label}>
                  <td>{group.label}</td>
                  <td className="money">{formatCents(group.current)}</td>
                  {comparisonReport ? <><td className="money">{formatCents(group.previous)}</td><td className="money">{formatPercentageChange(group.current, group.previous)}</td></> : null}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td style={{ fontWeight: 700 }}>Resultado gerencial</td>
                <td className="money" style={{ fontWeight: 700 }}>{formatCents(report.totalCents)}</td>
                {comparisonReport ? <><td className="money" style={{ fontWeight: 700 }}>{formatCents(comparisonReport.totalCents)}</td><td className="money" style={{ fontWeight: 700 }}>{formatPercentageChange(report.totalCents, comparisonReport.totalCents)}</td></> : null}
              </tr>
            </tfoot>
          </table></div>
        )}
      </div>
    </main>
  );
}
