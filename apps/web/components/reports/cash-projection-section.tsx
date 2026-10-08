import Link from "next/link";
import type { getCashProjection } from "@ax-finance/domain";
import { CashProjectionChart } from "@/components/dashboard/cash-projection-chart";
import { formatCents } from "@/lib/currency";
import { formatDateOnly } from "@/lib/dates";

type Projection = Awaited<ReturnType<typeof getCashProjection>>;

export function CashProjectionSection({ report, periodQuery }: { report: Projection; periodQuery: string }) {
  const chart = report.series.map((row) => ({ date: row.date, projected: Number(row.plannedBalanceCents) / 100, withoutOverdue: Number(row.cautiousBalanceCents) / 100 }));
  const weeks = Array.from({ length: Math.ceil(report.series.length / 7) }, (_, i) => {
    const rows = report.series.slice(i * 7, i * 7 + 7);
    return { from: rows[0]!.date, to: rows.at(-1)!.date, receipts: rows.reduce((sum, r) => sum + r.receiptsCents, BigInt(0)), payments: rows.reduce((sum, r) => sum + r.paymentsCents, BigInt(0)), balance: rows.at(-1)!.cautiousBalanceCents };
  });
  return <section className="card" aria-labelledby="cash-projection-heading">
    <div className="workspace-card-heading report-section-heading"><div><h2 id="cash-projection-heading">Planejamento de caixa</h2><p>De {formatDateOnly(report.today)} a {formatDateOnly(report.through)} · a partir do saldo disponível de hoje</p></div>
      <nav className="report-navigation report-horizon" aria-label="Horizonte da projeção">{([30, 60, 90] as const).map((days) => <Link key={days} href={`?${periodQuery}&dias=${days}#cash-projection-heading`} aria-current={days === report.days ? "page" : undefined}>{days} dias</Link>)}</nav>
    </div>
    <section className="workspace-metrics" aria-label="Resumo da projeção">
      <div className="workspace-metric"><span className="workspace-metric-label">Disponível hoje</span><strong>{formatCents(report.availableBalanceCents)}</strong><span className="workspace-metric-detail">Contas ativas incluídas no disponível · limite de cartão excluído</span></div>
      <div className="workspace-metric"><span className="workspace-metric-label">Saldo previsto no fim</span><strong>{formatCents(report.projectedBalanceCents)}</strong><span className="workspace-metric-detail">Pressupõe recebimento de todos os títulos, inclusive vencidos</span></div>
      <div className={`workspace-metric ${report.cautiousBalanceCents < BigInt(0) ? "workspace-metric-alert" : "workspace-metric-primary"}`}><span className="workspace-metric-label">Saldo sem recebíveis vencidos</span><strong>{formatCents(report.cautiousBalanceCents)}</strong><span className="workspace-metric-detail">Mantém todas as obrigações a pagar</span></div>
    </section>
    {report.firstNegativeDate ? <div className="report-notice report-notice-alert"><strong>Risco de falta de caixa em {formatDateOnly(report.firstNegativeDate)}</strong><p>O menor saldo sem recebíveis vencidos é {formatCents(report.minimumCents)}. Seriam necessários {formatCents(report.cashNeededCents)} adicionais para manter o saldo diário não negativo neste cenário.</p><Link href="/relatorios/em-aberto?tipo=PAYABLE">Revisar obrigações a pagar</Link></div> : <p className="report-caption">O cenário sem recebíveis vencidos mantém saldo diário não negativo no horizonte. Confira os vencimentos antes de assumir novos compromissos.</p>}
    <div className="report-chart-legend"><span>Curva contínua: todos os recebíveis</span><span>Curva tracejada: sem recebíveis vencidos</span></div>
    <CashProjectionChart data={chart} distinguishScenarios />
    <p className="report-caption">As duas curvas são cenários do mesmo saldo. Recebíveis vencidos ({formatCents(report.overdueReceivableCents)}) e obrigações vencidas ({formatCents(report.overduePayableCents)}) entram no primeiro dia; a segunda curva exclui os recebíveis vencidos. Faturas de cartão, inclusive abertas e futuras, entram uma vez pelo saldo da fatura.</p>
    <details className="report-details"><summary>Conferir vencimentos e saldos por semana</summary><div className="table-scroll"><table className="workspace-table"><caption className="sr-only">Projeção semanal de principal em aberto</caption><thead><tr><th scope="col">Intervalo</th><th scope="col" className="money">A receber</th><th scope="col" className="money">A pagar</th><th scope="col" className="money">Saldo sem recebíveis vencidos</th></tr></thead><tbody>{weeks.map((row) => <tr key={row.from}><td>{formatDateOnly(row.from)} a {formatDateOnly(row.to)}</td><td className="money">{formatCents(row.receipts)}</td><td className="money">{formatCents(row.payments)}</td><td className={`money ${row.balance < BigInt(0) ? "report-negative" : ""}`}>{formatCents(row.balance)}</td></tr>)}</tbody></table></div></details>
    <p className="report-caption">Estimativa pelos vencimentos cadastrados e principal pendente; agendamentos bancários não alteram esta previsão. Não prevê novas vendas, despesas ainda não lançadas, juros futuros, taxas ou mudanças de data. Recorrências só entram quando geram títulos. O menor saldo considera fechamentos diários, sem a ordem dos movimentos dentro do dia.</p>
  </section>;
}
