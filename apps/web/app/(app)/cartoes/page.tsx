import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CreditCardAccessRestrictedError,
  listActiveCategories,
  listCostCenters,
  listCreditCards,
  listFinancialAccounts,
  listParties,
  todayInTimeZone,
  summarizeCreditCardPortfolio,
  formatReferenceMonth,
} from "@ax-finance/domain";
import { CreditCard } from "@/components/ui/animated-icons";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { formatCents } from "@/lib/currency";
import { formatDateOnly } from "@/lib/dates";
import { ActionModal } from "@/components/ui/action-modal";
import { CardForm, BRAND_LABEL } from "@/components/credit-cards/card-form";
import { PurchaseForm } from "@/components/credit-cards/purchase-form";
import { InvoiceStageBadge } from "@/components/credit-cards/invoice-stage-badge";
import { LimitBar } from "@/components/credit-cards/limit-bar";
import { IssuerBadge } from "@/components/credit-cards/issuer-badge";
import { createCardAction, createPurchaseAction } from "./actions";

export default async function CartoesPage(props: {
  searchParams: Promise<{ erro?: string; cartao?: string; comprado?: string; arquivado?: string; reativado?: string; excluido?: string }>;
}) {
  const searchParams = await props.searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await requirePrimaryCompany(user.id);

  let cards: Awaited<ReturnType<typeof listCreditCards>>;
  try {
    cards = await listCreditCards(user.id, company.id, { includeArchived: true });
  } catch (error) {
    if (error instanceof CreditCardAccessRestrictedError) {
      return (
        <main className="wide">
          <div className="page-header"><h1>Cartões de crédito</h1></div>
          <div className="card"><div className="workspace-empty"><strong>Disponível só com acesso total</strong><p>{error.message}</p></div></div>
        </main>
      );
    }
    throw error;
  }

  const [accounts, categories, parties, costCenters] = await Promise.all([
    listFinancialAccounts(user.id, company.id),
    listActiveCategories(user.id, company.id),
    listParties(user.id, company.id, { role: "SUPPLIER", status: "ACTIVE" }),
    listCostCenters(user.id, company.id),
  ]);

  const activeCards = cards.filter((card) => card.status === "ACTIVE");
  const today = todayInTimeZone(company.timezone);
  const summary = summarizeCreditCardPortfolio(cards, today);
  const availableLimit = summary.totalLimitCents - summary.activeUsedCents;
  const attentionCards = [...cards].sort((a, b) => b.overdueCount - a.overdueCount || a.name.localeCompare(b.name));
  const createFailed = Boolean(searchParams.erro) && !searchParams.cartao;
  const refreshKey = [searchParams.erro, searchParams.comprado, searchParams.arquivado, searchParams.reativado, searchParams.excluido].join("|");

  return (
    <main className="wide">
      <div className="page-header">
        <div><h1>Cartões de crédito</h1><p className="subtitle">Acompanhe o que deve, quando vai pagar e quanto do limite já está comprometido.</p></div>
        <ActionModal
          key={`novo-${refreshKey}`}
          triggerLabel="+ Novo cartão"
          triggerClassName="button-link workspace-primary-action"
          title="Novo cartão de crédito"
          size="wide"
          icon={<CreditCard className="size-5" strokeWidth={1.5} />}
          initiallyOpen={createFailed}
        >
          {createFailed ? <p className="error">{searchParams.erro}</p> : null}
          <CardForm action={createCardAction} accounts={accounts} idPrefix="novo-cartao" submitLabel="Criar cartão" />
        </ActionModal>
      </div>

      {searchParams.arquivado ? <p className="success-box">Cartão arquivado. O histórico de compras e faturas continua disponível.</p> : null}
      {searchParams.reativado ? <p className="success-box">Cartão reativado.</p> : null}
      {searchParams.excluido ? <p className="success-box">Cartão excluído.</p> : null}
      {searchParams.comprado ? <p className="success-box">Compra lançada na fatura.</p> : null}

      <section className="workspace-metrics credit-management-metrics" aria-label="Resumo dos cartões">
        <div className="workspace-metric workspace-metric-primary">
          <span className="workspace-metric-label">Dívida total nos cartões</span>
          <strong>{formatCents(summary.totalDebtCents)}</strong>
          <span className="workspace-metric-detail">Saldo de todas as faturas, incluindo parcelas futuras e cartões arquivados</span>
        </div>
        <div className="workspace-metric">
          <span className="workspace-metric-label">Vence nos próximos 30 dias</span>
          <strong>{formatCents(summary.dueSoonCents)}</strong>
          <span className="workspace-metric-detail">De hoje até {formatDateOnly(summary.dueSoonThrough)} · inclui faturas ainda abertas</span>
        </div>
        <div className="workspace-metric">
          <span className="workspace-metric-label">Faturas vencidas</span>
          <strong className={summary.overdueCents > BigInt(0) ? "negative" : undefined}>{formatCents(summary.overdueCents)}</strong>
          <span className="workspace-metric-detail">{summary.overdue.length} {summary.overdue.length === 1 ? "fatura em atraso" : "faturas em atraso"} · fora do total dos próximos 30 dias</span>
        </div>
        <div className="workspace-metric">
          <span className="workspace-metric-label">Limite disponível</span>
          <strong className={availableLimit < BigInt(0) ? "negative" : undefined}>{formatCents(availableLimit)}</strong>
          <span className="workspace-metric-detail">de {formatCents(summary.totalLimitCents)} em {activeCards.length} cartões ativos · limite não é saldo em conta</span>
        </div>
      </section>

      {summary.overdue.length > 0 ? <div className="credit-attention" role="status"><strong>{formatCents(summary.overdueCents)} precisam de atenção</strong><p>Há faturas vencidas. Confira os encargos na fatura do banco antes de registrar o pagamento. {cards.some((card) => card.status === "ARCHIVED" && card.usedLimitCents > BigInt(0)) ? "Um cartão arquivado voltou a ter saldo pendente e está incluído nesta visão." : ""}</p><a href="#agenda-cartoes">Conferir pendências →</a></div> : null}

      {cards.length > 0 ? <section className="card" aria-label="Compromissos dos próximos meses">
        <div className="workspace-card-heading"><div><h2>O que já está comprometido</h2><p>Saldo a pagar por mês de vencimento, com as parcelas já lançadas. Faturas abertas ainda podem aumentar.</p></div><span className="credit-summary-note">Parcelas em faturas futuras: <strong>{formatCents(summary.futureCents)}</strong></span></div>
        <div className="credit-months">{summary.months.map((month) => <div className="credit-month" key={month.referenceMonth}><span>{formatReferenceMonth(month.referenceMonth)}</span><strong>{formatCents(month.remainingCents)}</strong><small>{month.invoiceCount} {month.invoiceCount === 1 ? "fatura" : "faturas"}</small></div>)}</div>
        <p className="credit-summary-note">{summary.beyondHorizonCents > BigInt(0) ? `Há ainda ${formatCents(summary.beyondHorizonCents)} após esses seis meses. ` : ""}Esta previsão considera compras registradas; novas compras e encargos ainda não lançados não estão incluídos. <Link href="/relatorios/fluxo-de-caixa">Comparar com o fluxo de caixa →</Link></p>
      </section> : null}

      {summary.overdue.length + summary.dueSoon.length > 0 ? <section className="card" id="agenda-cartoes" aria-label="Agenda de faturas">
        <div className="workspace-card-heading"><div><h2>Faturas que pedem atenção</h2><p>Vencidas e com vencimento nos próximos 30 dias. Todas as faturas fechadas pendentes somam {formatCents(summary.payableCents)}.</p></div></div>
        <div className="table-scroll"><table className="workspace-table"><thead><tr><th>Cartão / fatura</th><th>Vencimento</th><th className="money">Falta pagar</th><th>Situação</th><th aria-label="Abrir fatura" /></tr></thead><tbody>{[...summary.overdue, ...summary.dueSoon].map((invoice) => <tr key={invoice.id}><td><strong>{invoice.cardName}</strong><span className="muted"> · {formatReferenceMonth(invoice.referenceMonth)}{invoice.archived ? " · arquivado" : ""}</span></td><td>{formatDateOnly(invoice.dueDate)}</td><td className={`money${invoice.stage === "OVERDUE" ? " negative" : ""}`}>{formatCents(invoice.remainingCents)}</td><td><InvoiceStageBadge stage={invoice.stage} /></td><td><Link href={`/cartoes/${invoice.cardId}/faturas/${invoice.id}`} aria-label={`Conferir fatura ${formatReferenceMonth(invoice.referenceMonth)} de ${invoice.cardName}`}>Conferir →</Link></td></tr>)}</tbody></table></div>
      </section> : null}

      {cards.length === 0 ? (
        <div className="card">
          <div className="workspace-empty">
            <strong>Nenhum cartão cadastrado</strong>
            <p>Cadastre um cartão com o limite e os dias de fechamento e vencimento. As compras lançadas nele somam numa fatura por ciclo.</p>
          </div>
        </div>
      ) : (
        <div className="card-tiles">
          {attentionCards.map((card) => {
            const purchaseFailed = Boolean(searchParams.erro) && searchParams.cartao === card.id;
            return (
              <article key={card.id} className={`card card-tile${card.status === "ARCHIVED" ? " is-archived" : ""}`}>
                <header className="card-tile-header">
                  <IssuerBadge issuer={card.issuer} />
                  <div className="card-tile-title">
                    <h2><Link href={`/cartoes/${card.id}`}>{card.name}</Link></h2>
                    <span className="muted">
                      {BRAND_LABEL[card.brand] ?? card.brand}{card.lastDigits ? ` · final ${card.lastDigits}` : ""}
                    </span>
                  </div>
                  {card.status === "ARCHIVED" ? <span className="workspace-status">Arquivado</span> : null}
                </header>

                <LimitBar limitCents={card.limitCents} usedCents={card.usedLimitCents} />
                {card.overdueCount > 0 ? <p className="credit-card-warning">{card.overdueCount} {card.overdueCount === 1 ? "fatura vencida" : "faturas vencidas"} · {formatCents(card.overdueCents)} em atraso</p> : null}

                <dl className="card-tile-facts">
                  <div>
                    <dt>Fatura aberta</dt>
                    <dd>{formatCents(card.openCycle.totalCents)}</dd>
                    <small>fecha em {formatDateOnly(card.openCycle.closingDate)} · vence em {formatDateOnly(card.openCycle.dueDate)}</small>
                  </div>
                  <div>
                    <dt>Próximo pagamento</dt>
                    {card.nextPayable ? (
                      <>
                        <dd>{formatCents(card.nextPayable.remainingCents)}</dd>
                        <small>vence em {formatDateOnly(card.nextPayable.dueDate)} <InvoiceStageBadge stage={card.nextPayable.stage} /></small>
                      </>
                    ) : (
                      <>
                        <dd>—</dd>
                        <small>Nenhuma fatura fechada para pagar</small>
                      </>
                    )}
                  </div>
                </dl>

                <p className="credit-summary-note">Fechadas a pagar: <strong>{formatCents(card.payableCents)}</strong> · Faturas futuras: <strong>{formatCents(card.futureCents)}</strong></p>
                <footer className="card-tile-actions">
                  {card.status === "ACTIVE" ? (
                    <ActionModal
                      key={`compra-${card.id}-${refreshKey}`}
                      triggerLabel="Lançar compra"
                      triggerClassName="button-link workspace-primary-action"
                      title={`Nova compra — ${card.name}`}
                      size="wide"
                      icon={<CreditCard className="size-5" strokeWidth={1.5} />}
                      initiallyOpen={purchaseFailed}
                    >
                      {purchaseFailed ? <p className="error">{searchParams.erro}</p> : null}
                      <PurchaseForm
                        action={createPurchaseAction.bind(null, card.id, "lista")}
                        categories={categories}
                        parties={parties}
                        costCenters={costCenters}
                        idPrefix={`compra-${card.id}`}
                        today={today}
                        card={card}
                      />
                    </ActionModal>
                  ) : null}
                  <Link href={`/cartoes/${card.id}`} className="button-link">Abrir cartão</Link>
                </footer>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
