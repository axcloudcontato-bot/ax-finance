import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  CreditCardAccessRestrictedError,
  CreditCardInvoiceNotFoundError,
  formatReferenceMonth,
  getCreditCardInvoice,
  listActiveCategories,
  listCostCenters,
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
import { SubmitButton } from "@/components/ui/submit-button";
import { PurchaseForm } from "@/components/credit-cards/purchase-form";
import { InvoiceStageBadge } from "@/components/credit-cards/invoice-stage-badge";
import { cancelPurchaseAction, payInvoiceAction, updatePurchaseAction } from "../../../actions";

/** "1234,56" — o formato que o leitor de valores aceita de volta. */
function toInputAmount(cents: bigint): string {
  return (Number(cents) / 100).toFixed(2).replace(".", ",");
}

export default async function FaturaPage(props: {
  params: Promise<{ cardId: string; invoiceId: string }>;
  searchParams: Promise<{ erroPagamento?: string; erroEdicao?: string; erroCancelamento?: string; compra?: string; pago?: string; editado?: string; cancelado?: string }>;
}) {
  const { cardId, invoiceId } = await props.params;
  const searchParams = await props.searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await requirePrimaryCompany(user.id);

  let detail: Awaited<ReturnType<typeof getCreditCardInvoice>>;
  try {
    detail = await getCreditCardInvoice(user.id, company.id, invoiceId);
  } catch (error) {
    if (error instanceof CreditCardInvoiceNotFoundError) notFound();
    if (error instanceof CreditCardAccessRestrictedError) redirect("/cartoes");
    throw error;
  }
  const { invoice, card, purchases, canceledPurchases, byCategory, payments } = detail;
  if (card.id !== cardId) notFound();

  const [accounts, categories, parties, costCenters] = await Promise.all([
    listFinancialAccounts(user.id, company.id),
    listActiveCategories(user.id, company.id),
    listParties(user.id, company.id, { role: "SUPPLIER", status: "ACTIVE" }),
    listCostCenters(user.id, company.id),
  ]);

  const today = todayInTimeZone(company.timezone);
  const payable = invoice.stage === "CLOSED" || invoice.stage === "OVERDUE";
  const locked = invoice.stage === "PAID";
  const refreshKey = [searchParams.pago, searchParams.editado, searchParams.cancelado, searchParams.erroPagamento, searchParams.erroEdicao, searchParams.erroCancelamento].join("|");
  const monthLabel = formatReferenceMonth(invoice.referenceMonth);
  const activePayments = payments.filter((payment) => !payment.reversedAt);

  return (
    <main className="wide">
      <p className="breadcrumb"><Link href="/cartoes">Cartões de crédito</Link> / <Link href={`/cartoes/${card.id}`}>{card.name}</Link></p>
      <div className="page-header">
        <div>
          <h1>Fatura {monthLabel} <InvoiceStageBadge stage={invoice.stage} /></h1>
          <p className="subtitle">{card.name} · fecha em {formatDateOnly(invoice.closingDate)} · vence em {formatDateOnly(invoice.dueDate)}</p>
        </div>
        {payable ? (
          <ActionModal
            key={`pagar-${refreshKey}`}
            triggerLabel="Pagar fatura"
            triggerClassName="button-link workspace-primary-action"
            title={`Pagar fatura ${monthLabel} — ${card.name}`}
            icon={<CreditCard className="size-5" strokeWidth={1.5} />}
            initiallyOpen={Boolean(searchParams.erroPagamento)}
          >
            {searchParams.erroPagamento ? <p className="error">{searchParams.erroPagamento}</p> : null}
            {accounts.length === 0 ? (
              <p className="muted">Cadastre uma conta antes de registrar o pagamento.</p>
            ) : (
              <form action={payInvoiceAction.bind(null, card.id, invoice.id)}>
                <input type="hidden" name="idempotencyKey" value={randomUUID()} />
                <p className="subtitle">Falta pagar {formatCents(invoice.remainingCents)}. Para pagar menos, reduza o valor; o restante continua em aberto nesta fatura.</p>
                <div className="form-grid">
                  <div className="span-2">
                    <label htmlFor="pay-account">Pagar com a conta</label>
                    <select id="pay-account" name="financialAccountId" required defaultValue={card.defaultPaymentAccountId ?? ""}>
                      <option value="" disabled>Selecione</option>
                      {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="pay-amount">Valor pago (R$)</label>
                    <input id="pay-amount" name="amount" type="text" inputMode="decimal" defaultValue={toInputAmount(invoice.remainingCents)} required />
                  </div>
                  <div>
                    <label htmlFor="pay-date">Data do pagamento</label>
                    <input id="pay-date" name="effectiveDate" type="date" defaultValue={today} required />
                  </div>
                  <div>
                    <label htmlFor="pay-interest">Juros e multa (R$)</label>
                    <input id="pay-interest" name="interestPenalty" type="text" inputMode="decimal" defaultValue="0,00" />
                  </div>
                  <div>
                    <label htmlFor="pay-fees">Tarifas (R$)</label>
                    <input id="pay-fees" name="fees" type="text" inputMode="decimal" defaultValue="0,00" />
                  </div>
                  <div className="span-2">
                    <label htmlFor="pay-notes">Observações</label>
                    <input id="pay-notes" name="notes" type="text" maxLength={2000} />
                  </div>
                </div>
                <SubmitButton>Registrar pagamento</SubmitButton>
              </form>
            )}
          </ActionModal>
        ) : null}
      </div>

      {searchParams.pago ? <p className="success-box">Pagamento registrado.</p> : null}
      {searchParams.editado ? <p className="success-box">Compra atualizada.</p> : null}
      {searchParams.cancelado ? <p className="success-box">Compra cancelada e fatura recalculada.</p> : null}

      <section className="workspace-metrics" aria-label="Resumo da fatura">
        <div className="workspace-metric workspace-metric-primary">
          <span className="workspace-metric-label">Total da fatura</span>
          <strong>{formatCents(invoice.totalCents)}</strong>
          <span className="workspace-metric-detail">{purchases.length} {purchases.length === 1 ? "lançamento" : "lançamentos"}</span>
        </div>
        <div className="workspace-metric">
          <span className="workspace-metric-label">Já pago</span>
          <strong>{formatCents(invoice.paidCents)}</strong>
          <span className="workspace-metric-detail">{activePayments.length} {activePayments.length === 1 ? "pagamento" : "pagamentos"}</span>
        </div>
        <div className="workspace-metric">
          <span className="workspace-metric-label">Falta pagar</span>
          <strong>{formatCents(invoice.remainingCents)}</strong>
          <span className="workspace-metric-detail">vence em {formatDateOnly(invoice.dueDate)}</span>
        </div>
      </section>

      <div className="card">
        <div className="workspace-card-heading"><div><h2>Compras desta fatura</h2>
          <p>{locked ? "Fatura paga: para alterar as compras, estorne o pagamento antes." : "Valor e data definem a fatura; para corrigi-los, cancele a compra e lance de novo."}</p></div></div>
        {purchases.length === 0 ? (
          <div className="workspace-empty"><strong>Nenhuma compra ativa</strong><p>As compras canceladas ficam no histórico abaixo.</p></div>
        ) : (
          <div className="table-scroll">
            <table className="workspace-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Descrição</th>
                  <th>Categoria</th>
                  <th className="money">Valor</th>
                  <th aria-label="Ações"></th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((purchase) => {
                  const editFailed = searchParams.compra === purchase.id && Boolean(searchParams.erroEdicao);
                  const cancelFailed = searchParams.compra === purchase.id && Boolean(searchParams.erroCancelamento);
                  return (
                    <tr key={purchase.id}>
                      <td>{formatDateOnly(purchase.purchaseDate)}</td>
                      <td>
                        {purchase.description}
                        {purchase.installmentNumber ? <span className="muted"> · parcela {purchase.installmentNumber}/{purchase.installmentCount}</span> : null}
                        {purchase.party ? <span className="muted"> · {purchase.party.name}</span> : null}
                      </td>
                      <td>{purchase.category.name}{purchase.costCenter ? <span className="muted"> · {purchase.costCenter.name}</span> : null}</td>
                      <td className="money">{formatCents(purchase.amountCents)}</td>
                      <td>
                        {locked ? null : (
                          <details className="workspace-row-actions" open={editFailed || cancelFailed}>
                            <summary>Gerenciar</summary>
                            <div>
                              <ActionModal key={`editar-${purchase.id}-${refreshKey}`} triggerLabel="Editar" title={`Editar compra — ${purchase.description}`} initiallyOpen={editFailed}>
                                {editFailed ? <p className="error">{searchParams.erroEdicao}</p> : null}
                                <PurchaseForm
                                  action={updatePurchaseAction.bind(null, card.id, invoice.id, purchase.id)}
                                  categories={categories}
                                  parties={parties}
                                  costCenters={costCenters}
                                  idPrefix={`editar-${purchase.id}`}
                                  defaults={{ description: purchase.description, categoryId: purchase.categoryId, partyId: purchase.partyId, costCenterId: purchase.costCenterId, notes: purchase.notes }}
                                />
                              </ActionModal>
                              <ActionModal key={`cancelar-${purchase.id}-${refreshKey}`} triggerLabel="Cancelar compra" title={`Cancelar compra — ${purchase.description}`} initiallyOpen={cancelFailed}>
                                {cancelFailed ? <p className="error">{searchParams.erroCancelamento}</p> : null}
                                <form action={cancelPurchaseAction.bind(null, card.id, invoice.id, purchase.id)}>
                                  <p className="subtitle">A compra sai desta fatura e o total é recalculado. Fica o registro do cancelamento na auditoria.</p>
                                  <label htmlFor={`cancel-reason-${purchase.id}`}>Motivo</label>
                                  <input id={`cancel-reason-${purchase.id}`} name="reason" type="text" required maxLength={500} placeholder="Ex.: compra devolvida, lançada em duplicidade" />
                                  {purchase.installmentNumber && purchase.installmentNumber < (purchase.installmentCount ?? 0) ? (
                                    <label className="record-detail-checkbox">
                                      <input type="checkbox" name="includeFollowingInstallments" value="true" /> Cancelar também as parcelas seguintes ({(purchase.installmentCount ?? 0) - purchase.installmentNumber})
                                    </label>
                                  ) : null}
                                  <SubmitButton className="secondary">Cancelar compra</SubmitButton>
                                </form>
                              </ActionModal>
                            </div>
                          </details>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {byCategory.length > 0 ? (
        <div className="card">
          <div className="workspace-card-heading"><div><h2>Onde foi o dinheiro</h2><p>Total desta fatura por categoria.</p></div></div>
          <div className="category-ranking">
            {byCategory.map((row) => {
              const share = invoice.totalCents > BigInt(0) ? Number((row.cents * BigInt(1000)) / invoice.totalCents) / 10 : 0;
              return (
                <div className="category-ranking-row" key={row.categoryId}>
                  <div><span>{row.name}</span><strong className="negative">{formatCents(row.cents)} · {Math.round(share)}%</strong></div>
                  <div className="category-ranking-track"><span style={{ width: `${Math.max(2, share)}%` }} /></div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="card">
        <div className="workspace-card-heading"><div><h2>Pagamentos</h2>
          <p>O pagamento é uma baixa comum da fatura: pode ser estornado e conciliado com o extrato pela <Link href={`/saidas/${invoice.titleId}`}>página do título</Link>.</p></div></div>
        {payments.length === 0 ? (
          <div className="workspace-empty"><strong>Nenhum pagamento</strong><p>{payable ? "Use “Pagar fatura” quando for pagar." : "A fatura ainda não fechou; o pagamento fica disponível depois do fechamento."}</p></div>
        ) : (
          <div className="table-scroll">
            <table className="workspace-table">
              <thead><tr><th>Data</th><th>Conta</th><th className="money">Valor</th><th className="money">Juros/multa</th><th>Situação</th></tr></thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id} style={payment.reversedAt ? { opacity: 0.55 } : undefined}>
                    <td>{formatDateOnly(payment.effectiveDate)}</td>
                    <td>{payment.financialAccount.name}</td>
                    <td className="money">{formatCents(payment.principalAmountCents)}</td>
                    <td className="money">{formatCents(payment.interestPenaltyCents)}</td>
                    <td>{payment.reversedAt ? `Estornado${payment.reversalReason ? `: ${payment.reversalReason}` : ""}` : "Efetivado"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {canceledPurchases.length > 0 ? (
        <div className="card">
          <details>
            <summary>Compras canceladas ({canceledPurchases.length})</summary>
            <div className="table-scroll">
              <table className="workspace-table">
                <thead><tr><th>Data</th><th>Descrição</th><th className="money">Valor</th><th>Motivo</th></tr></thead>
                <tbody>
                  {canceledPurchases.map((purchase) => (
                    <tr key={purchase.id} style={{ opacity: 0.6 }}>
                      <td>{formatDateOnly(purchase.purchaseDate)}</td>
                      <td>{purchase.description}{purchase.installmentNumber ? ` · parcela ${purchase.installmentNumber}/${purchase.installmentCount}` : ""}</td>
                      <td className="money">{formatCents(purchase.amountCents)}</td>
                      <td>{purchase.cancelReason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      ) : null}
    </main>
  );
}
