import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfitabilityReport, getCompanyAccess } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { requirePlanFeature } from "@/lib/plan-access";
import { resolvePeriodRange } from "@/lib/month";
import { formatCents } from "@/lib/currency";
import { ReportNavigation } from "@/components/reports/report-navigation";
import { SubmitButton } from "@/components/ui/submit-button";
import { formatDateOnly } from "@/lib/dates";

export default async function ProfitabilityPage({ searchParams }: { searchParams: Promise<{ de?: string; ate?: string; mes?: string; periodo?: string; rateio?: string; versao?: string }> }) {
  const query = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await requirePrimaryCompany(user.id);
  await requirePlanFeature(user.id, company.id, "MANAGERIAL_DRE");
  const access = await getCompanyAccess(user.id, company.id);
  if (!access.hasFullCompanyAccess) return <main className="wide"><h1>Rentabilidade</h1><p className="report-notice">Este relatório consolida a empresa e exige acesso a todos os centros de custo e contas.</p></main>;
  const { from, to } = resolvePeriodRange(query);
  const fixedAllocation = query.rateio === "REVENUE" ? "REVENUE" : "NONE";
  const report = await getProfitabilityReport(user.id, company.id, { from, to, fixedAllocation, snapshotId: query.versao });
  const total = report.totals;
  const money = (value: bigint | null) => value === null ? "—" : formatCents(value);
  const exportQuery = new URLSearchParams({ de: from, ate: to, rateio: fixedAllocation, ...(query.versao ? { versao: query.versao } : {}) });
  return <main className="wide reports-page">
    <div className="page-header"><div><h1>Rentabilidade por projeto ou serviço</h1><p className="subtitle">Use centros de custo para separar projetos, contratos ou serviços. Resultado por competência, com os rateios cadastrados nos lançamentos.</p></div><a className="button-link" href={`/api/reports/profitability?${exportQuery}`}>Exportar CSV</a></div>
    <ReportNavigation active="profitability" from={from} to={to} snapshotId={query.versao} />
    <section className="card"><form method="get" className="workspace-report-filters">
      {query.versao ? <input name="versao" value={query.versao} type="hidden" /> : null}
      <div><label htmlFor="from">De</label><input id="from" name="de" type="date" required readOnly={Boolean(query.versao)} defaultValue={from} /></div><div><label htmlFor="to">Até</label><input id="to" name="ate" type="date" required readOnly={Boolean(query.versao)} defaultValue={to} /></div>
      <div><label htmlFor="fixedAllocation">Gastos fixos sem centro</label><select id="fixedAllocation" name="rateio" defaultValue={fixedAllocation}><option value="NONE">Manter sem alocação</option><option value="REVENUE">Distribuir pela receita positiva de cada centro</option></select></div><SubmitButton>Calcular</SubmitButton>
    </form></section>
    <p className="report-notice">{report.capturedAsOf ? `Versão preservada em ${formatDateOnly(report.capturedAsOf)}. Categorias, centros e valores permanecem como estavam na captura.` : "Consulta dos lançamentos vigentes. Para consultar uma versão histórica, abra Rentabilidade em Versões preservadas no Fechamento ou Relatório mensal."}</p>
    <section className="workspace-metrics report-metrics-four">
      <div className="workspace-metric"><span className="workspace-metric-label">Receita operacional registrada</span><strong>{money(total.revenueCents)}</strong></div>
      <div className="workspace-metric"><span className="workspace-metric-label">Gastos variáveis classificados</span><strong>{money(total.variableCents)}</strong></div>
      <div className="workspace-metric"><span className="workspace-metric-label">Margem de contribuição</span><strong>{money(total.contributionCents)}</strong><span className="workspace-metric-detail">{total.contributionBps === null ? "Classificação incompleta ou sem receita" : `${(total.contributionBps / 100).toLocaleString("pt-BR")}% da receita`}</span></div>
      <div className="workspace-metric"><span className="workspace-metric-label">Ponto de equilíbrio estimado</span><strong>{money(total.breakEvenCents)}</strong><span className="workspace-metric-detail">{total.breakEvenCents === null ? "Exige classificação completa e margem positiva" : `Receita necessária no período · margem de segurança ${money(total.safetyMarginCents)}`}</span></div>
    </section>
    {report.unclassifiedCategories.length ? <div className="report-notice report-notice-alert"><strong>Classifique os gastos antes de interpretar a margem</strong><p>{report.unclassifiedCategories.map((category) => category.name).join(", ")}. O resultado operacional inclui esses gastos; a margem e o ponto de equilíbrio ficam indisponíveis onde a base está incompleta.</p><Link href="/cadastros/categorias">Classificar categorias como fixas ou variáveis</Link></div> : null}
    {report.hasUnassignedVariable ? <p className="report-notice report-notice-alert">Há gastos variáveis ou não classificados sem centro. Aloque-os nos lançamentos para obter margem por projeto; a margem consolidada só depende da classificação dos gastos.</p> : null}
    <section className="card"><h2>Contribuição e resultado por centro</h2><p className="report-caption">Receita menos gastos variáveis = contribuição; menos fixos diretos e rateados = resultado. Custos e despesas não são automaticamente variáveis.</p>
      {report.rows.length ? <div className="table-scroll"><table className="workspace-table"><thead><tr><th>Centro / projeto / serviço</th><th className="money">Receita operacional</th><th className="money">Variáveis</th><th className="money">Contribuição</th><th className="money">Fixos diretos</th><th className="money">Fixos rateados</th><th className="money">Não classificados</th><th className="money">Resultado operacional</th><th className="money">Ponto de equilíbrio</th></tr></thead>
        <tbody>{report.rows.map((row) => <tr key={row.id}><td>{row.name}{row.id !== "UNASSIGNED" ? <small className="report-version-links"><Link href={`/entradas?centro=${row.id}`}>Receitas</Link><Link href={`/saidas?centro=${row.id}`}>Gastos</Link></small> : null}</td><td className="money">{money(row.revenueCents)}</td><td className="money">{money(row.variableCents)}</td><td className="money">{money(row.contributionCents)}{row.contributionBps !== null ? <small style={{ display: "block" }}>{row.contributionBps / 100}%</small> : null}</td><td className="money">{money(row.fixedCents)}</td><td className="money">{money(row.allocatedFixedCents)}</td><td className="money">{money(row.unclassifiedCents)}</td><td className={`money ${row.resultCents < BigInt(0) ? "report-negative" : ""}`}>{money(row.resultCents)}</td><td className="money">{money(row.breakEvenCents)}</td></tr>)}</tbody>
        <tfoot><tr><th>Total</th><td className="money">{money(total.revenueCents)}</td><td className="money">{money(total.variableCents)}</td><td className="money">{money(total.contributionCents)}</td><td className="money">{money(total.fixedCents - report.allocatedFixedCents)}</td><td className="money">{money(report.allocatedFixedCents)}</td><td className="money">{money(total.unclassifiedCents)}</td><td className="money">{money(total.resultCents)}</td><td className="money">{money(total.breakEvenCents)}</td></tr></tfoot>
      </table></div> : <p className="muted">Sem receitas ou gastos operacionais nesta competência.</p>}
      <p className="report-caption">{fixedAllocation === "REVENUE" ? `Rateio gerencial pela participação na receita positiva, com arredondamento que preserva todos os centavos. ${money(report.allocatedFixedCents)} distribuídos.` : "Gastos fixos sem centro permanecem identificados, sem distribuição automática."} O rateio não altera os lançamentos.</p>
    </section>
    <p className="report-notice">A receita registrada soma entradas e saídas na natureza de receita operacional; impostos e comissões variáveis precisam de categorias próprias. Nos títulos rateados, valem a categoria e o centro de cada linha; centros vazios ficam sem alocação. Compras no cartão entram pela competência, sem duplicar faturas. Investimentos, aportes, amortizações e juros contratuais de dívidas ficam fora deste resultado operacional. Taxas, juros e descontos de baixas e devoluções de caixa devem ser conferidos na DRE; esta análise não substitui o lucro líquido contábil.</p>
    <p className="report-caption">Ponto de equilíbrio = gastos fixos ÷ percentual de contribuição, usando a razão exata e arredondamento para cima em centavos. Depende da composição das vendas e dos gastos no período; não é meta garantida. <Link href="/cadastros/centros-de-custo">Organizar projetos e serviços</Link>.</p>
  </main>;
}
