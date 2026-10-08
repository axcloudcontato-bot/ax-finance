import Link from "next/link";
import { redirect } from "next/navigation";
import { getManagerialIncomeStatement } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { formatCents } from "@/lib/currency";
import { formatDateOnly } from "@/lib/dates";
import { resolveComparison, resolvePeriodRange } from "@/lib/month";
import { formatPercentageChange } from "@/lib/comparison";
import { requirePlanFeature } from "@/lib/plan-access";
import { ReportNavigation } from "@/components/reports/report-navigation";
import { NATURE_LABEL } from "@/lib/category-labels";

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
  const percentOfRevenue = (cents: bigint) => report.revenueCents > BigInt(0) ? `${(Number(cents * BigInt(10000) / report.revenueCents) / 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "Sem base de receita";
  const structure = [
    { label: "Receita operacional", current: report.revenueCents, previous: comparisonReport?.revenueCents ?? zero },
    { label: "Custos", current: report.costCents, previous: comparisonReport?.costCents ?? zero },
    { label: "Resultado bruto", current: report.grossResultCents, previous: comparisonReport?.grossResultCents ?? zero, subtotal: true },
    { label: "Despesas operacionais", current: report.expenseCents, previous: comparisonReport?.expenseCents ?? zero },
    { label: "Resultado operacional", current: report.operatingResultCents, previous: comparisonReport?.operatingResultCents ?? zero, subtotal: true },
    { label: "Resultado financeiro", current: report.financialResultCents, previous: comparisonReport?.financialResultCents ?? zero },
    { label: "Resultado gerencial do período", current: report.totalCents, previous: comparisonReport?.totalCents ?? zero, subtotal: true },
  ];
  const operationalGroups = (r: typeof report | null) => (r?.natureGroups ?? []).filter((row) => ["OPERATING_REVENUE", "COST", "EXPENSE"].includes(row.nature)).map((row) => ({ label: row.label === NATURE_LABEL[row.nature] ? row.label : `${NATURE_LABEL[row.nature]} · ${row.label}`, cents: row.cents }));

  const sections = [
    {
      title: "Resultado operacional",
      note: "Receitas, custos e despesas por competência.",
      rows: merge(operationalGroups(report), operationalGroups(comparisonReport)),
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

  return (
    <main className="wide reports-page">
      <ReportNavigation active="dre" from={from} to={to} comparison={searchParams.comparar} />
      <div className="page-header"><h1>DRE gerencial</h1><a href={exportHref} className="button-link">Exportar CSV</a></div>
      <p className="muted" style={{ marginBottom: "1rem" }}>
        {company.name} · {formatDateOnly(from)} a {formatDateOnly(to)} · operacional por competência · financeiro por data da baixa ·
        gerado em {new Date().toLocaleString("pt-BR", { timeZone: company.timezone })}
      </p>
      {comparison ? (
        <p className="comparison-banner">
          Comparando com {comparison.label.toLowerCase()}: {formatDateOnly(comparison.from)} a {formatDateOnly(comparison.to)}.
        </p>
      ) : null}

      <section className="workspace-metrics report-metrics-four" aria-label="Resumo da DRE gerencial">
        <div className="workspace-metric workspace-metric-primary"><span className="workspace-metric-label">Resultado do período</span><strong>{formatCents(report.totalCents)}</strong><span className="workspace-metric-detail">Operacional mais financeiro</span></div>
        <div className="workspace-metric"><span className="workspace-metric-label">Margem operacional</span><strong>{percentOfRevenue(report.operatingResultCents)}</strong><span className="workspace-metric-detail">Resultado operacional ÷ receita operacional</span></div>
        <div className="workspace-metric"><span className="workspace-metric-label">Resultado financeiro</span><strong>{formatCents(report.financialResultCents)}</strong><span className="workspace-metric-detail">Juros, tarifas e descontos</span></div>
        <div className="workspace-metric"><span className="workspace-metric-label">Margem do resultado gerencial</span><strong>{percentOfRevenue(report.totalCents)}</strong><span className="workspace-metric-detail">Resultado do período ÷ receita operacional</span></div>
      </section>
      {report.totalCents < zero ? <p className="report-notice report-notice-alert"><strong>Resultado gerencial negativo.</strong> Confira custos, despesas e encargos antes de usar o saldo de caixa como medida de rentabilidade.</p> : null}
      {report.ungroupedCategoryCount > 0 ? <p className="report-notice">{report.ungroupedCategoryCount} categorias operacionais sem grupo gerencial usam o nome da natureza. <Link href="/cadastros/categorias">Organizar grupos para detalhar o resultado</Link>.</p> : null}
      {report.unusualSignCount > 0 ? <p className="report-notice report-notice-alert">{report.unusualSignCount} lançamentos têm sinal atípico para a natureza: saídas em receita ou entradas em custo/despesa. Podem ser ajustes legítimos; confira a classificação.</p> : null}
      {report.unclassifiedRefundCents > zero ? <p className="report-notice report-notice-alert">Há {formatCents(report.unclassifiedRefundCents)} em devoluções/reembolsos no período. Esses registros movimentam caixa, mas não informam a natureza do ajuste de resultado; a DRE não os deduz automaticamente. Revise sua classificação antes de interpretar a margem.</p> : null}
      <div className="card"><h2>Formação do resultado</h2><p className="report-caption">Valores com sinal: receitas somam; custos e despesas reduzem. A análise vertical mostra cada linha como percentual da receita operacional.</p><div className="table-scroll"><table className="workspace-table"><thead><tr><th scope="col">Linha gerencial</th><th scope="col" className="money">Período atual</th><th scope="col" className="money">% da receita</th>{compared ? <><th scope="col" className="money">{comparison?.label}</th><th scope="col" className="money">Diferença em R$</th><th scope="col" className="money">Variação %</th></> : null}</tr></thead><tbody>{structure.map((row) => <tr key={row.label} className={row.subtotal ? "report-subtotal" : undefined}><th scope="row">{row.label}</th><td className="money">{formatCents(row.current)}</td><td className="money">{percentOfRevenue(row.current)}</td>{compared ? <><td className="money">{formatCents(row.previous)}</td><td className="money">{formatCents(row.current - row.previous)}</td><td className="money">{formatPercentageChange(row.current, row.previous)}</td></> : null}</tr>)}</tbody></table></div><p className="report-caption">A variação usa o valor absoluto da base anterior. Aumento de uma despesa com sinal negativo não significa melhora. Este demonstrativo depende das categorias cadastradas; não calcula tributos, depreciação ou EBITDA automaticamente.</p></div>
      <details className="workspace-method-note"><summary>Como este resultado é calculado</summary><p>O resultado operacional usa a competência e o valor original dos títulos, inclusive os ainda em aberto; títulos cancelados ficam fora, e as compras no cartão entram pela própria categoria. O resultado financeiro soma juros, multas, tarifas e descontos pela data da baixa. Investimento, financiamento e patrimônio (aportes, retiradas, amortização de empréstimo, compra de equipamento) mexem no caixa e não no lucro: aparecem abaixo, só para conferência, fora do total.</p></details>
      <p className="report-caption">O resultado financeiro segue a data efetiva dos encargos, pois o sistema não tem competência separada para eles. Lucro gerencial não é dinheiro disponível. <Link href={`/relatorios/fluxo-de-caixa?de=${from}&ate=${to}`}>Conferir o caixa no mesmo período</Link>.</p>

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

      <div className="card"><h2>Detalhamento por categoria</h2><p className="report-caption">Categorias permanecem separadas por natureza mesmo quando têm o mesmo grupo gerencial. Valores de rateios e compras de cartão preservam sua classificação.</p>{report.categoryDetails.length ? <div className="table-scroll"><table className="workspace-table"><thead><tr><th scope="col">Natureza</th><th scope="col">Grupo</th><th scope="col">Categoria</th><th scope="col" className="money">Valor</th><th scope="col" className="money">% da receita</th></tr></thead><tbody>{report.categoryDetails.map((row) => <tr key={row.categoryId}><td>{NATURE_LABEL[row.nature]}</td><td>{row.group}</td><td>{row.categoryName}</td><td className="money">{formatCents(row.cents)}</td><td className="money">{["OPERATING_REVENUE", "COST", "EXPENSE"].includes(row.nature) ? percentOfRevenue(row.cents) : "Fora do resultado"}</td></tr>)}</tbody></table></div> : <p className="report-caption">Nenhum título ou compra na competência selecionada.</p>}</div>

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
