import Link from "next/link";
import type { getDebt } from "@ax-finance/domain";
import { formatCents } from "@/lib/currency";
import { formatDateOnly } from "@/lib/dates";

type Debt = Awaited<ReturnType<typeof getDebt>>;

const STATE_LABEL: Record<string, string> = { PAID_BEFORE: "Paga antes", PAID: "Paga", OPEN: "Em aberto", PARTIAL: "Paga parcialmente", OVERDUE: "Vencida", REMOVED: "Removida · saldo preservado", CANCELLED: "Cancelada · saldo preservado" };
const STATE_CLASS: Record<string, string> = { PAID_BEFORE: "", PAID: "is-active", OPEN: "", PARTIAL: "", OVERDUE: "is-overdue", REMOVED: "", CANCELLED: "" };

/** Situação da dívida: saldo devedor, o que falta pagar e os juros restantes. */
export function DebtMetrics({ debt }: { debt: Debt }) {
  return (
    <section className="workspace-metrics debt-metrics" aria-label="Situação da dívida">
      <div className="workspace-metric workspace-metric-primary"><span className="workspace-metric-label">Saldo devedor</span><strong>{formatCents(debt.balanceCents)}</strong><span className="workspace-metric-detail">{Math.round(debt.paidPercent)}% quitado · {debt.paidCount} de {debt.installmentCount} parcelas</span></div>
      <div className="workspace-metric"><span className="workspace-metric-label">Falta pagar (com juros)</span><strong>{formatCents(debt.remainingPaymentsCents)}</strong><span className="workspace-metric-detail">{debt.installmentCount - debt.paidCount} parcelas</span></div>
      <div className="workspace-metric"><span className="workspace-metric-label">Juros que ainda vai pagar</span><strong className="negative">{formatCents(debt.remainingInterestCents)}</strong><span className="workspace-metric-detail">de {formatCents(debt.totalInterestCents)} no contrato todo</span></div>
    </section>
  );
}

/** Tabela de amortização: cada parcela com juros, amortização, saldo e situação. */
export function DebtScheduleTable({ debt }: { debt: Debt }) {
  return (
    <div className="table-scroll">
      <table className="workspace-table debt-table">
        <thead><tr><th>Parcela</th><th>Vencimento</th><th className="money">Valor contratado</th><th className="money">Juros</th><th className="money">Amortização</th><th className="money">Saldo na tabela</th><th className="money">Falta pagar</th><th>Situação</th></tr></thead>
        <tbody>
          {debt.rows.map((row) => (
            <tr key={row.number} className={row.state === "PAID" || row.state === "PAID_BEFORE" ? "is-paid" : undefined}>
              <td>{row.titleId ? <Link href={`/saidas/${row.titleId}`}>{row.number}/{debt.installmentCount}</Link> : `${row.number}/${debt.installmentCount}`}</td>
              <td>{formatDateOnly(row.dueDate)}</td>
              <td className="money">{formatCents(row.paymentCents)}</td>
              <td className="money">{formatCents(row.interestCents)}</td>
              <td className="money">{formatCents(row.amortizationCents)}</td>
              <td className="money">{formatCents(row.balanceCents)}</td>
              <td className="money">{formatCents(row.remainingPaymentCents)}</td>
              <td><span className={`workspace-status ${STATE_CLASS[row.state]}`}>{STATE_LABEL[row.state]}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
