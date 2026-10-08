import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  CreditCardAccessRestrictedError,
  CreditCardNotFoundError,
  formatReferenceMonth,
  getCreditCard,
  listActiveCategories,
  listCostCenters,
  listFinancialAccounts,
  listParties,
  todayInTimeZone,
} from "@ax-finance/domain";
import { CreditCard, Trash2 } from "@/components/ui/animated-icons";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { formatCents } from "@/lib/currency";
import { formatDateOnly } from "@/lib/dates";
import { ActionModal } from "@/components/ui/action-modal";
import { SubmitButton } from "@/components/ui/submit-button";
import { CardForm, BRAND_LABEL } from "@/components/credit-cards/card-form";
import { PurchaseForm } from "@/components/credit-cards/purchase-form";
import { InvoiceStageBadge } from "@/components/credit-cards/invoice-stage-badge";
import { LimitBar } from "@/components/credit-cards/limit-bar";
import { IssuerBadge } from "@/components/credit-cards/issuer-badge";
import { createPurchaseAction, deleteCardAction, setCardArchivedAction, updateCardAction } from "../actions";

export default async function CartaoPage(props: {
  params: Promise<{ cardId: string }>;
  searchParams: Promise<{ erro?: string; erroCartao?: string; comprado?: string; atualizado?: string; novo?: string }>;
}) {
  const { cardId } = await props.params;
  const searchParams = await props.searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await requirePrimaryCompany(user.id);

  let detail: Awaited<ReturnType<typeof getCreditCard>>;
  try {
    detail = await getCreditCard(user.id, company.id, cardId);
  } catch (error) {
    if (error instanceof CreditCardNotFoundError) notFound();
    if (error instanceof CreditCardAccessRestrictedError) redirect("/cartoes");
    throw error;
  }
  const { card, usedLimitCents, availableLimitCents, openCycle } = detail;
  // O que pede atenção vem primeiro (vencida, fechada, aberta); depois as futuras; as pagas por último, da mais recente.
  const STAGE_RANK = { OVERDUE: 0, CLOSED: 1, OPEN: 2, FUTURE: 3, PAID: 4, EMPTY: 5 } as const;
  const invoices = [...detail.invoices].sort((left, right) =>
    STAGE_RANK[left.stage] - STAGE_RANK[right.stage] ||
    (left.stage === "PAID" ? right.dueDate.localeCompare(left.dueDate) : left.dueDate.localeCompare(right.dueDate)));

  const [accounts, categories, parties, costCenters] = await Promise.all([
    listFinancialAccounts(user.id, company.id),
    listActiveCategories(user.id, company.id),
    listParties(user.id, company.id, { role: "SUPPLIER", status: "ACTIVE" }),
    listCostCenters(user.id, company.id),
  ]);

  const openInvoice = invoices.find((invoice) => invoice.stage === "OPEN");
  const refreshKey = [searchParams.erro, searchParams.comprado, searchParams.atualizado].join("|");
  const archived = card.status === "ARCHIVED";

  return (
    <main className="wide">
      <p className="breadcrumb"><Link href="/cartoes">← Cartões de crédito</Link></p>
      <div className="page-header">
        <div className="card-page-heading">
          <IssuerBadge issuer={card.issuer} size={48} />
          <div>
          <h1>{card.name}</h1>
          <p className="subtitle">
            {BRAND_LABEL[card.brand] ?? card.brand}{card.lastDigits ? ` · final ${card.lastDigits}` : ""} · fecha dia {card.closingDay} · vence dia {card.dueDay}
            {card.defaultPaymentAccount ? ` · paga pela conta ${card.defaultPaymentAccount.name}` : ""}
          </p>
          </div>
        </div>
        {archived ? (
          <span className="workspace-status">Arquivado</span>
        ) : (
          <ActionModal
            key={`compra-${refreshKey}`}
            triggerLabel="+ Nova compra"
            triggerClassName="button-link workspace-primary-action"
            title={`Nova compra — ${card.name}`}
            icon={<CreditCard className="size-5" strokeWidth={1.5} />}
            initiallyOpen={Boolean(searchParams.erro)}
          >
            {searchParams.erro ? <p className="error">{searchParams.erro}</p> : null}
            <PurchaseForm
              action={createPurchaseAction.bind(null, card.id, "cartao")}
              categories={categories}
              parties={parties}
              costCenters={costCenters}
              idPrefix="compra"
              today={todayInTimeZone(company.timezone)}
            />
          </ActionModal>
        )}
      </div>

      {searchParams.novo ? <p className="success-box">Cartão criado. Lance a primeira compra para abrir a fatura.</p> : null}
      {searchParams.comprado ? <p className="success-box">Compra lançada na fatura.</p> : null}
      {searchParams.atualizado ? <p className="success-box">Cartão atualizado.</p> : null}
      {searchParams.erroCartao ? <p className="error">{searchParams.erroCartao}</p> : null}

      <section className="workspace-metrics" aria-label="Resumo do cartão">
        <div className="workspace-metric workspace-metric-primary">
          <span className="workspace-metric-label">Fatura aberta</span>
          <strong>{formatCents(openInvoice?.totalCents ?? BigInt(0))}</strong>
          <span className="workspace-metric-detail">fecha em {formatDateOnly(openCycle.closingDate)} · vence em {formatDateOnly(openCycle.dueDate)}</span>
        </div>
        <div className="workspace-metric">
          <span className="workspace-metric-label">Limite em uso</span>
          <strong>{formatCents(usedLimitCents)}</strong>
          <span className="workspace-metric-detail">de {formatCents(card.limitCents)}</span>
        </div>
        <div className="workspace-metric">
          <span className="workspace-metric-label">Limite disponível</span>
          <strong className={availableLimitCents < BigInt(0) ? "negative" : undefined}>{formatCents(availableLimitCents)}</strong>
          <span className="workspace-metric-detail">Inclui parcelas das próximas faturas</span>
        </div>
      </section>

      <div className="card">
        <LimitBar limitCents={card.limitCents} usedCents={usedLimitCents} />
      </div>

      <div className="card">
        <div className="workspace-card-heading">
          <div>
            <h2>Faturas</h2>
            <p>Compras feitas até o dia anterior ao fechamento entram na fatura do mês; a partir do dia {card.closingDay}, na seguinte.</p>
          </div>
        </div>
        {invoices.length === 0 ? (
          <div className="workspace-empty"><strong>Nenhuma compra lançada</strong><p>A fatura é criada na primeira compra deste cartão.</p></div>
        ) : (
          <div className="table-scroll">
            <table className="workspace-table">
              <thead>
                <tr>
                  <th>Fatura</th>
                  <th>Fecha em</th>
                  <th>Vence em</th>
                  <th className="money">Total</th>
                  <th className="money">Pago</th>
                  <th className="money">Falta pagar</th>
                  <th>Situação</th>
                  <th aria-label="Abrir"></th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td><strong>{formatReferenceMonth(invoice.referenceMonth)}</strong> <span className="muted">· {invoice.purchaseCount} {invoice.purchaseCount === 1 ? "compra" : "compras"}</span></td>
                    <td>{formatDateOnly(invoice.closingDate)}</td>
                    <td>{formatDateOnly(invoice.dueDate)}</td>
                    <td className="money">{formatCents(invoice.totalCents)}</td>
                    <td className="money">{formatCents(invoice.paidCents)}</td>
                    <td className="money" style={{ fontWeight: 600 }}>{formatCents(invoice.remainingCents)}</td>
                    <td><InvoiceStageBadge stage={invoice.stage} /></td>
                    <td><Link href={`/cartoes/${card.id}/faturas/${invoice.id}`}>Abrir</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <div className="workspace-card-heading"><div><h2>Configuração do cartão</h2><p>Limite, dias e conta de pagamento. Mudar os dias só vale para faturas ainda não criadas.</p></div></div>
        <div className="card-config-actions">
          <ActionModal
            key={`editar-${refreshKey}`}
            triggerLabel="Editar cartão"
            title={`Editar — ${card.name}`}
            icon={<CreditCard className="size-5" strokeWidth={1.5} />}
            initiallyOpen={Boolean(searchParams.erroCartao)}
          >
            {searchParams.erroCartao ? <p className="error">{searchParams.erroCartao}</p> : null}
            <CardForm action={updateCardAction.bind(null, card.id)} accounts={accounts} defaults={card} idPrefix="editar-cartao" />
          </ActionModal>
          <form action={setCardArchivedAction.bind(null, card.id, !archived)} className="inline">
            <SubmitButton className="secondary">{archived ? "Reativar cartão" : "Arquivar cartão"}</SubmitButton>
          </form>
          <ActionModal triggerLabel={<Trash2 size={16} />} triggerAriaLabel="Excluir cartão" triggerClassName="concil-icon-btn is-danger" title={`Excluir — ${card.name}`}>
            <p>
              {invoices.length === 0
                ? `O cartão ${card.name} será excluído.`
                : `O cartão ${card.name}, ${invoices.length === 1 ? "a fatura" : `as ${invoices.length} faturas`} e as compras lançadas nele (${formatCents(invoices.reduce((total, invoice) => total + invoice.totalCents, BigInt(0)))} em faturas) serão apagados. As compras deixam de aparecer no DRE e no orçamento.`}
            </p>
            <p className="muted">Não dá para desfazer. Para guardar o histórico, arquive o cartão em vez de excluir. Se alguma fatura já tiver pagamento registrado, a exclusão é recusada.</p>
            <form action={deleteCardAction.bind(null, card.id)}>
              <SubmitButton>Excluir cartão</SubmitButton>
            </form>
          </ActionModal>
        </div>
      </div>
    </main>
  );
}
