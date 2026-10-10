import Link from "next/link";
import { redirect } from "next/navigation";
import { Landmark } from "@/components/ui/animated-icons";
import {
  CompanyAccessDeniedError,
  EVENT_TYPE_LABEL,
  TitleNotFoundError,
  getTitle,
  getLateFeeSettings,
  paymentMethodLabel,
  suggestLateCharges,
  listAuditEvents,
  listFinancialAccounts,
  listActiveCategories,
  listCostCenters,
  listParties,
  listInstallments,
  listTitleAttachments,
} from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { formatCents } from "@/lib/currency";
import { formatDateOnly, todayDateOnlyString } from "@/lib/dates";
import { TitleStatusBadge } from "@/components/titles/title-status-badge";
import { SettlementForm } from "@/components/titles/settlement-form";
import { CopyButton } from "@/components/titles/copy-button";
import { SchedulePaymentModal } from "@/components/titles/schedule-payment-modal";

import { ActionModal } from "@/components/ui/action-modal";
import { TitleAttachments } from "@/components/titles/title-attachments";
import { TitleEditForm } from "@/components/titles/title-edit-form";
import { AllocationForm } from "@/components/titles/allocation-form";
import { filterCategoriesByTitleType, sortCategoriesTree } from "@/lib/categories";
import { toDateOnlyString } from "@/lib/dates";
import {
  cancelSaidaAction,
  deleteSaidaAction,
  deleteSaidaInstallmentPlanAction,
  registerSaidaSettlementAction,
  reverseSaidaSettlementAction,
  clearSaidaAllocationsAction,
  duplicateSaidaAction,
  registerSaidaRefundAction,
  replaceSaidaAllocationsAction,
  reverseSaidaRefundAction,
  updateSaidaAction,
} from "../actions";
import { SubmitButton } from "@/components/ui/submit-button";

export default async function SaidaDetailPage(
  props: {
    params: Promise<{ titleId: string }>;
    searchParams: Promise<{ erro?: string; erroBaixa?: string; erroAnexo?: string; anexoAdicionado?: string; anexoRemovido?: string; erroEdicao?: string; erroDevolucao?: string; erroRateio?: string; atualizado?: string; agendado?: string; duplicado?: string; rateado?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const company = await requirePrimaryCompany(user.id);

  let title: Awaited<ReturnType<typeof getTitle>>;
  try {
    title = await getTitle(user.id, company.id, params.titleId);
  } catch (error) {
    if (error instanceof TitleNotFoundError || error instanceof CompanyAccessDeniedError) {
      redirect("/saidas");
    }
    throw error;
  }

  const [allAccounts, allCategories, suppliers, costCenters] = await Promise.all([
    listFinancialAccounts(user.id, company.id), listActiveCategories(user.id, company.id),
    listParties(user.id, company.id, { role: "SUPPLIER", status: "ACTIVE" }), listCostCenters(user.id, company.id),
  ]);
  const accounts = allAccounts.filter((account) => account.status === "ACTIVE");
  const categories = sortCategoriesTree(filterCategoriesByTitleType(allCategories, "PAYABLE"));
  const installments = title.installmentGroupId
    ? await listInstallments(user.id, company.id, title.installmentGroupId)
    : [];
  const auditEvents = await listAuditEvents(user.id, company.id, {
    resourceType: "Title",
    resourceId: title.id,
  });
  const attachments = await listTitleAttachments(user.id, company.id, title.id);
  const hasActiveSettlement = title.settlements.some((settlement) => !settlement.reversedAt);
  const registerSettlementAction = registerSaidaSettlementAction.bind(null, title.id);
  const cancelAction = cancelSaidaAction.bind(null, title.id);
  const deleteAction = deleteSaidaAction.bind(null, title.id);
  const deleteInstallmentPlanAction = title.installmentGroupId
    ? deleteSaidaInstallmentPlanAction.bind(null, title.installmentGroupId, title.id)
    : null;
  const cardInvoice = title.creditCardInvoice;
  const today = todayDateOnlyString();
  const dueDay = toDateOnlyString(title.dueDate);
  const isOpen = title.status !== "CANCELLED" && title.remainingCents > BigInt(0);
  const daysLate = Math.max(0, Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${dueDay}T00:00:00Z`)) / 86_400_000));
  const returnTo = `/saidas/${title.id}`;
  const expectedAccount = accounts.find((account) => account.id === title.expectedAccountId) ?? null;
  const moneyField = (cents: bigint) => (Number(cents) / 100).toFixed(2).replace(".", ",");
  const showSettlementForm = title.status !== "CANCELLED" && title.remainingCents > BigInt(0);
  const openBalanceCents = title.status === "CANCELLED" ? BigInt(0) : title.remainingCents;

  const infoAndHistory = (
    <>
      <nav className="record-detail-nav" aria-label="Navegação do lançamento">
        <Link href="/saidas">← Saídas</Link>
        <span>/</span>
        <span>Detalhe do lançamento</span>
      </nav>
      <div className="card">
        <div className="page-header record-detail-header">
          <div className="record-detail-heading">
            <span className="record-detail-eyebrow">Saída</span>
            <h1>{title.description}</h1>
            <p className="subtitle">
              {title.category.parentId ? "↳ " : ""}
              {title.category.name}
              {title.costCenter ? ` · ${title.costCenter.name}` : ""}
              {title.installmentGroupId ? ` · Parcela ${title.installmentNumber} de ${title.installmentCount}` : ""}
            </p>
          </div>
          <div className="record-detail-actions">
            <TitleStatusBadge status={title.status} dueDate={title.dueDate} />
            {cardInvoice ? (
              <Link href={`/cartoes/${cardInvoice.cardId}/faturas/${cardInvoice.id}`} className="button-link">Abrir fatura do cartão</Link>
            ) : (
              <>
            <ActionModal triggerLabel="Editar" title="Editar saída" initiallyOpen={Boolean(searchParams.erroEdicao)}>
              <TitleEditForm action={updateSaidaAction.bind(null, title.id)} title={title} categories={categories} parties={suppliers} costCenters={costCenters} accounts={accounts} partyLabel="Fornecedor" error={searchParams.erroEdicao}/>
            </ActionModal>
            <ActionModal triggerLabel="Duplicar" title="Duplicar saída">
              <p className="subtitle">A cópia nasce em aberto, sem pagamentos nem anexos. Ajuste as datas se necessário.</p>
              <form action={duplicateSaidaAction.bind(null, title.id)}><label htmlFor="duplicate-competence">Competência</label><input id="duplicate-competence" name="competenceDate" type="date" defaultValue={toDateOnlyString(title.competenceDate)} required/><label htmlFor="duplicate-due">Vencimento</label><input id="duplicate-due" name="dueDate" type="date" defaultValue={toDateOnlyString(title.dueDate)} required/><SubmitButton>Criar cópia</SubmitButton></form>
            </ActionModal>
              </>
            )}
            {isOpen && !cardInvoice ? <SchedulePaymentModal titleId={title.id} returnTo={returnTo} dueDate={title.dueDate} scheduledDate={title.scheduledPaymentDate} /> : null}
            {showSettlementForm ? (
              <ActionModal
                triggerLabel="Registrar pagamento"
                triggerClassName="button-link workspace-primary-action"
                title="Registrar pagamento"
                icon={<Landmark className="size-5" strokeWidth={1.5} />}
                initiallyOpen={Boolean(searchParams.erroBaixa)}
              >
                <SettlementForm
                  action={registerSettlementAction}
                  accounts={accounts}
                  defaults={{ financialAccountId: title.expectedAccountId, principal: moneyField(title.remainingCents), paymentMethod: title.expectedPaymentMethod }}
                  error={searchParams.erroBaixa}
                  submitLabel="Registrar pagamento"
                />
              </ActionModal>
            ) : null}
          </div>
        </div>

        {title.recurrenceRule ? (
          <p className="subtitle">
            Gerado pela recorrência:{" "}
            <Link href={`/saidas/recorrencias/${title.recurrenceRule.id}`}>
              {title.recurrenceRule.description}
            </Link>
          </p>
        ) : null}

        {cardInvoice ? (
          <p className="subtitle">
            Esta saída é a fatura {cardInvoice.referenceMonth.slice(5)}/{cardInvoice.referenceMonth.slice(0, 4)} de um cartão de crédito: o valor vem das compras lançadas nela.{" "}
            <Link href={`/cartoes/${cardInvoice.cardId}/faturas/${cardInvoice.id}`}>Ver compras da fatura</Link>. O pagamento pode ser registrado e estornado aqui normalmente.
          </p>
        ) : null}

        {searchParams.erro ? <p className="error">{searchParams.erro}</p> : null}
        {searchParams.atualizado ? <p className="success-box">Título atualizado.</p> : null}
        {searchParams.duplicado ? <p className="success-box">Cópia criada.</p> : null}
        {searchParams.agendado ? <p className="success-box">{searchParams.agendado === "1" ? "Pagamento agendado." : "Agendamento removido."}</p> : null}

        <div className="record-detail-metrics">
          <div className="record-detail-metric is-primary"><span>Saldo a pagar</span><strong>{formatCents(openBalanceCents, title.currency)}</strong><small>{title.status === "CANCELLED" ? "Título cancelado" : "Valor ainda pendente"}</small></div>
          <div className="record-detail-metric"><span>Valor original</span><strong>{formatCents(title.originalAmountCents, title.currency)}</strong><small>Valor lançado</small></div>
          <div className="record-detail-metric"><span>Vencimento</span><strong>{formatDateOnly(title.dueDate)}</strong><small>Competência: {formatDateOnly(title.competenceDate)}</small></div>
        </div>

        <dl className="record-detail-facts">
          {title.party ? <div><dt>Fornecedor</dt><dd><Link href={`/cadastros/pessoas/${title.party.id}`}>{title.party.name}</Link></dd></div> : null}
          {expectedAccount ? <div><dt>Conta prevista</dt><dd>{expectedAccount.name}</dd></div> : null}
          {title.expectedPaymentMethod ? <div><dt>Forma de pagamento</dt><dd>{paymentMethodLabel(title.expectedPaymentMethod)}</dd></div> : null}
          {title.documentNumber ? <div><dt>Documento</dt><dd>{title.documentNumber}</dd></div> : null}
          {title.paymentCode ? <div><dt>Dados de pagamento</dt><dd className="fact-copy"><code>{title.paymentCode}</code><CopyButton text={title.paymentCode} /></dd></div> : null}
          {title.scheduledPaymentDate && isOpen ? <div><dt>Agendado no banco</dt><dd>{formatDateOnly(title.scheduledPaymentDate)} <span className="muted">· continua em aberto até o pagamento ser registrado</span></dd></div> : null}
          {title.notes ? <div><dt>Observações</dt><dd>{title.notes}</dd></div> : null}
          {title.status === "CANCELLED" && title.cancelReason ? <div><dt>Motivo do cancelamento</dt><dd>{title.cancelReason}</dd></div> : null}
        </dl>

        {cardInvoice ? null : <details className="record-detail-more">
          <summary>Mais ações</summary>
          <div className="record-detail-more-actions">
            {title.status === "OPEN" && !hasActiveSettlement ? (
              <ActionModal triggerLabel="Cancelar título" title="Cancelar saída">
                <p className="subtitle">O lançamento deixará de compor o saldo em aberto. Informe o motivo para o histórico.</p>
                <form action={cancelAction}>
                  <label htmlFor="cancel-exit-reason">Motivo</label>
                  <input id="cancel-exit-reason" name="reason" type="text" maxLength={500} required />
                  <SubmitButton className="secondary">Confirmar cancelamento</SubmitButton>
                </form>
              </ActionModal>
            ) : null}
            <ActionModal triggerLabel="Remover título" title="Remover saída das telas">
              <p className="subtitle">O histórico, as baixas, conciliações e anexos serão preservados para auditoria.</p>
              <form action={deleteAction}>
                <label htmlFor="delete-exit-reason">Motivo</label>
                <input id="delete-exit-reason" name="reason" type="text" maxLength={500} required />
                <SubmitButton className="secondary">Confirmar remoção</SubmitButton>
              </form>
            </ActionModal>
            {deleteInstallmentPlanAction ? (
              <ActionModal triggerLabel="Remover parcelamento" title="Remover todas as parcelas">
                <p className="subtitle">Esta ação removerá as {installments.length} parcelas das telas. Informe o motivo para o histórico.</p>
                <form action={deleteInstallmentPlanAction}>
                  <label htmlFor="delete-exit-plan-reason">Motivo</label>
                  <input id="delete-exit-plan-reason" name="reason" maxLength={500} required />
                  <SubmitButton className="secondary">Confirmar remoção das parcelas</SubmitButton>
                </form>
              </ActionModal>
            ) : null}
          </div>
        </details>}
      </div>

      {installments.length > 0 ? (
        <div className="card">
          <div className="page-header" style={{ marginBottom: "0.5rem" }}>
            <h2>Parcelas</h2>
          </div>
          <table className="workspace-table">
            <thead>
              <tr>
                <th>Parcela</th>
                <th>Vencimento</th>
                  <th className="money">Saldo aberto</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {installments.map((installment) => (
                <tr key={installment.id} style={installment.id === title.id ? { fontWeight: 600 } : undefined}>
                  <td>
                    <Link href={`/saidas/${installment.id}`}>
                      {installment.installmentNumber} de {installment.installmentCount}
                    </Link>
                  </td>
                  <td>{formatDateOnly(installment.dueDate)}</td>
                  <td className="money">{installment.status === "CANCELLED" ? "—" : formatCents(installment.remainingCents, installment.currency)}</td>
                  <td>
                    <TitleStatusBadge status={installment.status} dueDate={installment.dueDate} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <TitleAttachments
        titleId={title.id}
        basePath="saidas"
        attachments={attachments}
        error={searchParams.erroAnexo}
        added={Boolean(searchParams.anexoAdicionado)}
        removed={Boolean(searchParams.anexoRemovido)}
      />

      {cardInvoice ? null : <div className="card">
        <div className="page-header" style={{marginBottom:"0.5rem"}}><div><h2>Rateio</h2><p className="subtitle">Divida o valor entre categorias e centros de custo. A soma precisa fechar o valor original.</p></div></div>
        {searchParams.rateado ? <p className="success-box">Rateio atualizado.</p> : null}
        <AllocationForm totalCents={Number(title.originalAmountCents)} action={replaceSaidaAllocationsAction.bind(null,title.id)} clearAction={clearSaidaAllocationsAction.bind(null,title.id)} categories={categories} costCenters={costCenters} error={searchParams.erroRateio} initial={title.allocations.map((item)=>({categoryId:item.categoryId,costCenterId:item.costCenterId,amount:(Number(item.amountCents)/100).toFixed(2).replace(".",",")}))}/>
      </div>}

      <div className="card">
        <h2>Pagamentos registrados</h2>
        {searchParams.erroDevolucao ? <p className="error">{searchParams.erroDevolucao}</p> : null}
        {title.settlements.length === 0 ? (
          <p className="muted">Nenhum pagamento registrado ainda.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Conta</th>
                <th>Principal</th>
                <th>Desconto</th>
                <th>Juros/multa</th>
                <th>Taxas</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {title.settlements.map((settlement) => {
                const reverseAction = reverseSaidaSettlementAction.bind(null, title.id, settlement.id);
                return (
                  <tr key={settlement.id} style={settlement.reversedAt ? { opacity: 0.5 } : undefined}>
                    <td>{formatDateOnly(settlement.effectiveDate)}</td>
                    <td>{settlement.financialAccount.name}</td>
                    <td>{formatCents(settlement.principalAmountCents)}</td>
                    <td>{formatCents(settlement.discountCents)}</td>
                    <td>{formatCents(settlement.interestPenaltyCents)}</td>
                    <td>{formatCents(settlement.feesCents)}</td>
                    <td>
                      {settlement.reversedAt ? (
                        "Estornada"
                      ) : (
                        <div style={{display:"flex",gap:"0.5rem",flexWrap:"wrap"}}>
                        <ActionModal triggerLabel="Registrar reembolso" title="Registrar reembolso">
                          <form action={registerSaidaRefundAction.bind(null,title.id,settlement.id)}><label>Conta</label><select name="financialAccountId" defaultValue={settlement.financialAccountId} required>{accounts.map((account)=><option key={account.id} value={account.id}>{account.name}</option>)}</select><label>Valor (R$)</label><input name="amount" inputMode="decimal" required/><label>Data</label><input name="effectiveDate" type="date" defaultValue={todayDateOnlyString()} required/><label>Motivo</label><input name="reason" required maxLength={500}/><SubmitButton>Registrar reembolso</SubmitButton></form>
                        </ActionModal>
                        <ActionModal triggerLabel="Estornar pagamento" title="Estornar pagamento">
                          <p className="subtitle">O pagamento de {formatCents(settlement.principalAmountCents)} em {formatDateOnly(settlement.effectiveDate)} será revertido e o saldo do título será recalculado.</p>
                          <form action={reverseAction}><label htmlFor={`reverse-exit-settlement-${settlement.id}`}>Motivo</label><input id={`reverse-exit-settlement-${settlement.id}`} name="reason" maxLength={500} required/><SubmitButton className="secondary">Confirmar estorno</SubmitButton></form>
                        </ActionModal></div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {title.settlements.some((item) => item.refunds.length > 0) ? (
          <>
            <h3 className="record-detail-subheading">Reembolsos</h3>
            <table className="workspace-table"><thead><tr><th>Data</th><th>Pagamento</th><th>Conta</th><th className="money">Valor</th><th>Motivo</th><th>Ação</th></tr></thead>
              <tbody>{title.settlements.flatMap((settlement) => settlement.refunds.map((refund) => (
                <tr key={refund.id} style={refund.reversedAt ? { opacity: 0.5 } : undefined}>
                  <td>{formatDateOnly(refund.effectiveDate)}</td><td>{formatDateOnly(settlement.effectiveDate)}</td><td>{refund.financialAccount.name}</td><td className="money">{formatCents(refund.amountCents)}</td><td>{refund.reason}</td>
                  <td>{refund.reversedAt ? "Estornado" : (
                    <ActionModal triggerLabel="Estornar reembolso" title="Estornar reembolso">
                      <p className="subtitle">O reembolso de {formatCents(refund.amountCents)} em {formatDateOnly(refund.effectiveDate)} será revertido.</p>
                      <form action={reverseSaidaRefundAction.bind(null, title.id, refund.id)}><label htmlFor={`reverse-exit-refund-${refund.id}`}>Motivo</label><input id={`reverse-exit-refund-${refund.id}`} name="reason" maxLength={500} required/><SubmitButton className="secondary">Confirmar estorno</SubmitButton></form>
                    </ActionModal>
                  )}</td>
                </tr>
              )))}</tbody>
            </table>
          </>
        ) : null}
      </div>
      <div className="card">
        <h2>Histórico</h2>
        {auditEvents.length === 0 ? (
          <p className="muted">Nenhum evento registrado ainda.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Evento</th>
                <th>Autor</th>
                <th>Detalhe</th>
              </tr>
            </thead>
            <tbody>
              {auditEvents.map((event) => (
                <tr key={event.id}>
                  <td>{new Date(event.createdAt).toLocaleString("pt-BR")}</td>
                  <td>{EVENT_TYPE_LABEL[event.eventType] ?? event.eventType}</td>
                  <td>{event.actorName}</td>
                  <td>{event.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );

  return <main className="wide record-detail">{infoAndHistory}</main>;
}
