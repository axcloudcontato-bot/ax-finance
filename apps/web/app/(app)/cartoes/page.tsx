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
import { createCardAction, createPurchaseAction } from "./actions";

export default async function CartoesPage(props: {
  searchParams: Promise<{ erro?: string; cartao?: string; comprado?: string; arquivado?: string; reativado?: string }>;
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
  const totalLimit = activeCards.reduce((sum, card) => sum + card.limitCents, BigInt(0));
  const totalUsed = activeCards.reduce((sum, card) => sum + card.usedLimitCents, BigInt(0));
  const toPay = activeCards.reduce((sum, card) => sum + (card.nextPayable?.remainingCents ?? BigInt(0)), BigInt(0));
  const createFailed = Boolean(searchParams.erro) && !searchParams.cartao;
  const refreshKey = [searchParams.erro, searchParams.comprado, searchParams.arquivado, searchParams.reativado].join("|");

  return (
    <main className="wide">
      <div className="page-header">
        <h1>Cartões de crédito</h1>
        <ActionModal
          key={`novo-${refreshKey}`}
          triggerLabel="+ Novo cartão"
          triggerClassName="button-link workspace-primary-action"
          title="Novo cartão de crédito"
          icon={<CreditCard className="size-5" strokeWidth={1.5} />}
          initiallyOpen={createFailed}
        >
          {createFailed ? <p className="error">{searchParams.erro}</p> : null}
          <CardForm action={createCardAction} accounts={accounts} idPrefix="novo-cartao" submitLabel="Criar cartão" />
        </ActionModal>
      </div>

      {searchParams.arquivado ? <p className="success-box">Cartão arquivado. O histórico de compras e faturas continua disponível.</p> : null}
      {searchParams.reativado ? <p className="success-box">Cartão reativado.</p> : null}
      {searchParams.comprado ? <p className="success-box">Compra lançada na fatura.</p> : null}

      <section className="workspace-metrics" aria-label="Resumo dos cartões">
        <div className="workspace-metric workspace-metric-primary">
          <span className="workspace-metric-label">Limite em uso</span>
          <strong>{formatCents(totalUsed)}</strong>
          <span className="workspace-metric-detail">de {formatCents(totalLimit)} em {activeCards.length} {activeCards.length === 1 ? "cartão" : "cartões"}</span>
        </div>
        <div className="workspace-metric">
          <span className="workspace-metric-label">Limite disponível</span>
          <strong>{formatCents(totalLimit - totalUsed)}</strong>
          <span className="workspace-metric-detail">Faturas em aberto e parcelas futuras já descontadas</span>
        </div>
        <div className="workspace-metric">
          <span className="workspace-metric-label">Faturas para pagar</span>
          <strong>{formatCents(toPay)}</strong>
          <span className="workspace-metric-detail">Já fechadas, aguardando pagamento</span>
        </div>
      </section>

      {cards.length === 0 ? (
        <div className="card">
          <div className="workspace-empty">
            <strong>Nenhum cartão cadastrado</strong>
            <p>Cadastre um cartão com o limite e os dias de fechamento e vencimento. As compras lançadas nele somam numa fatura por ciclo.</p>
          </div>
        </div>
      ) : (
        <div className="card-tiles">
          {cards.map((card) => {
            const purchaseFailed = Boolean(searchParams.erro) && searchParams.cartao === card.id;
            return (
              <article key={card.id} className={`card card-tile${card.status === "ARCHIVED" ? " is-archived" : ""}`}>
                <header className="card-tile-header">
                  <div>
                    <h2><Link href={`/cartoes/${card.id}`}>{card.name}</Link></h2>
                    <span className="muted">
                      {BRAND_LABEL[card.brand] ?? card.brand}{card.lastDigits ? ` · final ${card.lastDigits}` : ""}
                    </span>
                  </div>
                  {card.status === "ARCHIVED" ? <span className="workspace-status">Arquivado</span> : null}
                </header>

                <LimitBar limitCents={card.limitCents} usedCents={card.usedLimitCents} />

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

                <footer className="card-tile-actions">
                  {card.status === "ACTIVE" ? (
                    <ActionModal
                      key={`compra-${card.id}-${refreshKey}`}
                      triggerLabel="Lançar compra"
                      triggerClassName="button-link workspace-primary-action"
                      title={`Nova compra — ${card.name}`}
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
                        today={todayInTimeZone(company.timezone)}
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
