import Link from "next/link";
import { redirect } from "next/navigation";
import { getPaymentMethodReport } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { formatCents } from "@/lib/currency";
import { formatDateOnly } from "@/lib/dates";
import { resolvePeriodRange } from "@/lib/month";

export default async function PaymentMethodReportPage(props: { searchParams: Promise<{ de?: string; ate?: string; mes?: string; periodo?: string }> }) {
  const searchParams = await props.searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await requirePrimaryCompany(user.id);

  const period = resolvePeriodRange(searchParams);
  const report = await getPaymentMethodReport(user.id, company.id, { from: period.from, to: period.to });
  const unclassified = report.rows.find((row) => row.key === "NAO_INFORMADO");

  return (
    <main className="wide">
      <div className="page-header">
        <div>
          <h1>Entradas e saídas por forma de pagamento</h1>
          <p className="subtitle">
            {formatDateOnly(period.from)} a {formatDateOnly(period.to)}. O realizado vem das baixas do período, pelo meio de pagamento informado em cada baixa;
            o previsto é o que está em aberto com vencimento no período, pela forma prevista no lançamento.
          </p>
        </div>
      </div>

      <section className="workspace-metrics" aria-label="Totais do período">
        <div className="workspace-metric"><span className="workspace-metric-label">Recebido</span><strong>{formatCents(report.totals.receivedCents)}</strong><span className="workspace-metric-detail">Baixas de entradas no período</span></div>
        <div className="workspace-metric"><span className="workspace-metric-label">Pago</span><strong>{formatCents(report.totals.paidCents)}</strong><span className="workspace-metric-detail">Baixas de saídas no período</span></div>
        <div className="workspace-metric"><span className="workspace-metric-label">A receber</span><strong>{formatCents(report.totals.openReceivableCents)}</strong><span className="workspace-metric-detail">Em aberto, vencendo no período</span></div>
        <div className="workspace-metric"><span className="workspace-metric-label">A pagar</span><strong>{formatCents(report.totals.openPayableCents)}</strong><span className="workspace-metric-detail">Em aberto, vencendo no período</span></div>
      </section>

      <div className="card">
        {report.rows.length === 0 ? <p className="muted">Nenhuma baixa nem título em aberto neste período.</p> : (
          <div className="table-scroll">
            <table className="workspace-table">
              <thead>
                <tr>
                  <th>Forma de pagamento</th>
                  <th className="money">Recebido</th>
                  <th className="money">Pago</th>
                  <th className="money">A receber</th>
                  <th className="money">A pagar</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row) => (
                  <tr key={row.key}>
                    <td>
                      <strong>{row.label}</strong>
                      <small className="title-row-meta"><span>{row.settlementCount} {row.settlementCount === 1 ? "baixa" : "baixas"}</span><span>{row.openCount} em aberto</span></small>
                    </td>
                    <td className="money">{formatCents(row.receivedCents)}</td>
                    <td className="money">{formatCents(row.paidCents)}</td>
                    <td className="money">{formatCents(row.openReceivableCents)}</td>
                    <td className="money">{formatCents(row.openPayableCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {unclassified && (unclassified.openCount > 0 || unclassified.settlementCount > 0) ? (
          <p className="muted" style={{ marginTop: "1rem" }}>
            Há lançamentos e baixas sem forma de pagamento informada. Preencha a forma prevista ao lançar (em &ldquo;Mais detalhes&rdquo;) ou ao editar o lançamento em{" "}
            <Link href="/entradas">Entradas</Link> e <Link href="/saidas">Saídas</Link> para este relatório ficar completo.
          </p>
        ) : null}
      </div>
    </main>
  );
}
