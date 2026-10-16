import Link from "next/link";
import type { listCreditCards } from "@ax-finance/domain";
import { formatCents } from "@/lib/currency";
import { formatDateOnly } from "@/lib/dates";
import { monthLabel } from "@/lib/month";
import { LimitBar } from "./limit-bar";
import { InvoiceStageBadge } from "./invoice-stage-badge";
import { BRAND_LABEL } from "./card-form";

type CardSummary = Awaited<ReturnType<typeof listCreditCards>>[number];

/**
 * Detalhe do cartão no modal (Painel e lista de cartões): limite, fatura em andamento, o que há para
 * pagar e as faturas pendentes, cada uma com link. Compras e histórico ficam na página do cartão.
 */
export function CardDetailSummary({ card }: { card: CardSummary }) {
  const invoices = card.pendingInvoices;
  return (
    <div className="detail-summary">
      <p className="subtitle">
        {BRAND_LABEL[card.brand] ?? card.brand}{card.lastDigits ? ` · final ${card.lastDigits}` : ""} · fecha dia {card.closingDay} · vence dia {card.dueDay}
        {card.status === "ARCHIVED" ? " · arquivado" : ""}
      </p>
      <div className="detail-summary-limit">
        <LimitBar limitCents={card.limitCents} usedCents={card.usedLimitCents} />
      </div>
      <dl className="goal-detail-facts">
        <div><dt>Limite total</dt><dd>{formatCents(card.limitCents)}</dd></div>
        <div><dt>Disponível</dt><dd className={card.availableLimitCents < BigInt(0) ? "negative" : undefined}>{formatCents(card.availableLimitCents)}</dd></div>
        <div><dt>Fatura aberta</dt><dd>{formatCents(card.openCycle.totalCents)}</dd><small>fecha {formatDateOnly(card.openCycle.closingDate)} · vence {formatDateOnly(card.openCycle.dueDate)}</small></div>
        <div>
          <dt>Próximo pagamento</dt>
          {card.nextPayable
            ? <><dd className={card.nextPayable.stage === "OVERDUE" ? "negative" : undefined}>{formatCents(card.nextPayable.remainingCents)}</dd><small>{card.nextPayable.stage === "OVERDUE" ? "venceu" : "vence"} {formatDateOnly(card.nextPayable.dueDate)}</small></>
            : <><dd>—</dd><small>Nenhuma fatura fechada</small></>}
        </div>
      </dl>
      {card.overdueCount > 0 ? <p className="credit-card-warning">{card.overdueCount} {card.overdueCount === 1 ? "fatura vencida" : "faturas vencidas"} · {formatCents(card.overdueCents)} em atraso</p> : null}

      <h3 className="detail-summary-heading">Faturas pendentes</h3>
      {invoices.length === 0 ? <p className="muted">Nenhuma fatura com saldo a pagar.</p> : (
        <ul className="detail-summary-list">
          {invoices.map((invoice) => (
            <li key={invoice.id}>
              <Link href={`/cartoes/${card.id}/faturas/${invoice.id}`}>
                <span><strong>{monthLabel(invoice.referenceMonth)}</strong><small>vence {formatDateOnly(invoice.dueDate)}</small></span>
                <InvoiceStageBadge stage={invoice.stage} />
                <em>{formatCents(invoice.remainingCents)}</em>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="form-actions">
        <Link href={`/cartoes/${card.id}`} className="button-link workspace-primary-action">Abrir cartão</Link>
        {card.openCycle.invoiceId ? <Link href={`/cartoes/${card.id}/faturas/${card.openCycle.invoiceId}`} className="button-link">Ver fatura aberta</Link> : null}
      </div>
    </div>
  );
}
