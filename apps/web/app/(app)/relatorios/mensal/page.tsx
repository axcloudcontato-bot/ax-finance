import Link from "next/link";
import { redirect } from "next/navigation";
import { getMonthlyReportData } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { formatCents } from "@/lib/currency";
import { formatDateOnly } from "@/lib/dates";
import { addMonths, currentYearMonth, isYearMonth, monthLabel } from "@/lib/month";
import { SubmitButton } from "@/components/ui/submit-button";
import { sendMonthlyReportNowAction } from "./actions";

const ZERO = BigInt(0);
const percent = (bps: number) => `${(bps / 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

export default async function MonthlyReportPage(props: { searchParams: Promise<{ mes?: string; enviado?: string; erro?: string }> }) {
  const searchParams = await props.searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await requirePrimaryCompany(user.id);
  // padrão: o mês anterior, que é o que já fechou
  const month = isYearMonth(searchParams.mes) ? searchParams.mes : addMonths(currentYearMonth(), -1);
  const data = await getMonthlyReportData(user.id, company.id, month);
  const { result } = data;

  return (
    <main className="wide monthly-report-page">
      <div className="page-header">
        <div>
          <h1>Relatório mensal</h1>
          <p className="subtitle">O resumo do mês em PDF: resultado, caixa, maiores gastos, inadimplência e projeção. Chega por e-mail no início de cada mês para quem vê a empresa inteira.</p>
        </div>
        <div className="budget-year-actions">
          <nav className="calendar-nav" aria-label="Mudar de mês">
            <Link href={`/relatorios/mensal?mes=${addMonths(month, -1)}`} className="button-link" aria-label="Mês anterior">‹</Link>
            <strong>{monthLabel(month)}</strong>
            <Link href={`/relatorios/mensal?mes=${addMonths(month, 1)}`} className="button-link" aria-label="Próximo mês">›</Link>
          </nav>
          <a href={`/api/reports/monthly-pdf?mes=${month}`} className="button-link workspace-primary-action" target="_blank" rel="noopener">Baixar PDF</a>
        </div>
      </div>

      {searchParams.enviado ? <p className="success-box">Relatório de {monthLabel(month)} enviado para a fila de e-mail ({user.email}). Chega em alguns minutos.</p> : null}
      {searchParams.erro ? <p className="error">{searchParams.erro}</p> : null}

      <section className="card">
        <div className="workspace-card-heading"><div><h2>Resultado de {data.monthLabel}</h2><p>Por competência: receitas e despesas do mês, pagas ou não.</p></div></div>
        <div className="workspace-metrics monthly-report-metrics">
          <div className="workspace-metric"><span className="workspace-metric-label">Receitas</span><strong>{formatCents(result.revenueCents)}</strong>{data.previousResult ? <span className="workspace-metric-detail">mês anterior: {formatCents(data.previousResult.revenueCents)}</span> : null}</div>
          <div className="workspace-metric"><span className="workspace-metric-label">Despesas</span><strong>{formatCents(result.expenseCents)}</strong>{data.previousResult ? <span className="workspace-metric-detail">mês anterior: {formatCents(data.previousResult.expenseCents)}</span> : null}</div>
          <div className="workspace-metric workspace-metric-primary"><span className="workspace-metric-label">Resultado</span><strong className={result.resultCents < ZERO ? "negative" : undefined}>{formatCents(result.resultCents)}</strong><span className="workspace-metric-detail">{result.marginBps !== null ? `margem de ${percent(result.marginBps)}` : "sem receita no mês"}</span></div>
        </div>
      </section>

      <div className="dashboard-insight-grid">
        <section className="card dashboard-insight-section">
          <div className="dashboard-section-heading"><div><h2>Maiores gastos</h2><p>As categorias que mais pesaram no mês.</p></div></div>
          {data.topExpenses.length === 0 ? <p className="muted">Nenhuma despesa lançada neste mês.</p> : (
            <ul className="monthly-report-bars">
              {data.topExpenses.map((item) => (
                <li key={item.categoryId}>
                  <span>{item.name}</span>
                  <span className="monthly-report-bar"><i style={{ width: `${Math.max(2, item.shareBps / 100)}%` }} /></span>
                  <strong>{formatCents(item.cents)}</strong>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card dashboard-insight-section">
          <div className="dashboard-section-heading"><div><h2>Caixa, recebíveis e projeção</h2><p>Posição em {formatDateOnly(data.generatedOn)}.</p></div></div>
          <dl className="monthly-report-facts">
            <div><dt>Recebido no mês</dt><dd>{formatCents(data.cash.receivedCents)}</dd></div>
            <div><dt>Pago no mês</dt><dd>{formatCents(data.cash.paidCents)}</dd></div>
            <div><dt>A receber em aberto</dt><dd>{formatCents(data.delinquency.openReceivableCents)}</dd></div>
            <div><dt>Vencido (inadimplência)</dt><dd className={data.delinquency.overdueReceivableCents > ZERO ? "negative" : undefined}>{formatCents(data.delinquency.overdueReceivableCents)} · {percent(data.delinquency.delinquencyBps)}</dd></div>
            <div><dt>Saldo disponível hoje</dt><dd>{formatCents(data.projection.availableCents)}</dd></div>
            <div><dt>Previsto em 30 dias</dt><dd className={data.projection.projectedCents < ZERO ? "negative" : undefined}>{formatCents(data.projection.projectedCents)}</dd></div>
          </dl>
        </section>
      </div>

      <section className="card monthly-report-send">
        <div>
          <h2>Receber por e-mail</h2>
          <p className="muted">O envio automático acontece nos primeiros dias de cada mês, com o mês anterior, para proprietário, administrador financeiro e contador (dá para desligar em <Link href="/configuracoes/notificacoes">Notificações</Link>). Para receber este mês agora:</p>
        </div>
        <form action={sendMonthlyReportNowAction}>
          <input type="hidden" name="month" value={month} />
          <SubmitButton className="secondary">Enviar para {user.email}</SubmitButton>
        </form>
      </section>
    </main>
  );
}
