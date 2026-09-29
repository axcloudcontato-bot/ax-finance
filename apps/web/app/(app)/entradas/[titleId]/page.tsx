import Link from "next/link";
import { redirect } from "next/navigation";
import { Landmark } from "@/components/ui/animated-icons";
import {
  CompanyAccessDeniedError,
  EVENT_TYPE_LABEL,
  TitleNotFoundError,
  getTitle,
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
import { formatDateOnly } from "@/lib/dates";
import { TitleStatusBadge } from "@/components/titles/title-status-badge";
import { SettlementForm } from "@/components/titles/settlement-form";
import { ActionModal } from "@/components/ui/action-modal";
import { TitleAttachments } from "@/components/titles/title-attachments";
import { TitleEditForm } from "@/components/titles/title-edit-form";
import { AllocationForm } from "@/components/titles/allocation-form";
import { filterCategoriesByTitleType, sortCategoriesTree } from "@/lib/categories";
import { toDateOnlyString } from "@/lib/dates";
import {
  cancelEntradaAction,
  deleteEntradaAction,
  deleteEntradaInstallmentPlanAction,
  registerEntradaSettlementAction,
  reverseEntradaSettlementAction,
  clearEntradaAllocationsAction,
  duplicateEntradaAction,
  registerEntradaRefundAction,
  replaceEntradaAllocationsAction,
  reverseEntradaRefundAction,
  updateEntradaAction,
} from "../actions";

export default async function EntradaDetailPage(
  props: {
    params: Promise<{ titleId: string }>;
    searchParams: Promise<{ erro?: string; erroBaixa?: string; erroAnexo?: string; anexoAdicionado?: string; anexoRemovido?: string; erroEdicao?: string; erroDevolucao?: string; erroRateio?: string; atualizado?: string; duplicado?: string; rateado?: string }>;
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
      redirect("/entradas");
    }
    throw error;
  }

  const [allAccounts, allCategories, clients, costCenters] = await Promise.all([
    listFinancialAccounts(user.id, company.id), listActiveCategories(user.id, company.id),
    listParties(user.id, company.id, { role: "CLIENT", status: "ACTIVE" }), listCostCenters(user.id, company.id),
  ]);
  const accounts = allAccounts.filter((account) => account.status === "ACTIVE");
  const categories = sortCategoriesTree(filterCategoriesByTitleType(allCategories, "RECEIVABLE"));
  const installments = title.installmentGroupId
    ? await listInstallments(user.id, company.id, title.installmentGroupId)
    : [];
  const auditEvents = await listAuditEvents(user.id, company.id, {
    resourceType: "Title",
    resourceId: title.id,
  });
  const attachments = await listTitleAttachments(user.id, company.id, title.id);
  const hasActiveSettlement = title.settlements.some((settlement) => !settlement.reversedAt);
  const registerSettlementAction = registerEntradaSettlementAction.bind(null, title.id);
  const cancelAction = cancelEntradaAction.bind(null, title.id);
  const deleteAction = deleteEntradaAction.bind(null, title.id);
  const deleteInstallmentPlanAction = title.installmentGroupId
    ? deleteEntradaInstallmentPlanAction.bind(null, title.installmentGroupId, title.id)
    : null;
  const showSettlementForm = title.status !== "CANCELLED" && title.remainingCents > BigInt(0);

  const infoAndHistory = (
    <>
      <div className="card">
        <div className="page-header" style={{ marginBottom: "0.5rem" }}>
          <h1>{title.description}</h1>
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <TitleStatusBadge status={title.status} dueDate={title.dueDate} />
            <ActionModal triggerLabel="Editar" title="Editar entrada" initiallyOpen={Boolean(searchParams.erroEdicao)}>
              <TitleEditForm action={updateEntradaAction.bind(null, title.id)} title={title} categories={categories} parties={clients} costCenters={costCenters} partyLabel="Cliente" error={searchParams.erroEdicao}/>
            </ActionModal>
            <ActionModal triggerLabel="Duplicar" title="Duplicar entrada">
              <p className="subtitle">A cópia nasce em aberto, sem baixas nem anexos. Ajuste as datas se necessário.</p>
              <form action={duplicateEntradaAction.bind(null, title.id)}><label htmlFor="duplicate-competence">Competência</label><input id="duplicate-competence" name="competenceDate" type="date" defaultValue={toDateOnlyString(title.competenceDate)} required/><label htmlFor="duplicate-due">Vencimento</label><input id="duplicate-due" name="dueDate" type="date" defaultValue={toDateOnlyString(title.dueDate)} required/><button type="submit">Criar cópia</button></form>
            </ActionModal>
            {showSettlementForm ? (
              <ActionModal
                triggerLabel="Registrar baixa"
                title="Registrar baixa"
                icon={<Landmark className="size-5" strokeWidth={1.5} />}
                initiallyOpen={Boolean(searchParams.erroBaixa)}
              >
                <SettlementForm
                  action={registerSettlementAction}
                  accounts={accounts}
                  error={searchParams.erroBaixa}
                />
              </ActionModal>
            ) : null}
          </div>
        </div>
        <p className="subtitle">
          {title.category.parentId ? "↳ " : ""}
          {title.category.name}
          {title.costCenter ? ` · ${title.costCenter.name}` : ""}
          {title.installmentGroupId ? ` · Parcela ${title.installmentNumber} de ${title.installmentCount}` : ""}
        </p>

        {title.recurrenceRule ? (
          <p className="subtitle">
            Gerado pela recorrência:{" "}
            <Link href={`/entradas/recorrencias/${title.recurrenceRule.id}`}>
              {title.recurrenceRule.description}
            </Link>
          </p>
        ) : null}

        {searchParams.erro ? <p className="error">{searchParams.erro}</p> : null}
        {searchParams.atualizado ? <p className="success-box">Título atualizado.</p> : null}
        {searchParams.duplicado ? <p className="success-box">Cópia criada.</p> : null}

        <table>
          <tbody>
            {title.party ? (
              <tr>
                <td>Cliente</td>
                <td>
                  <Link href={`/cadastros/pessoas/${title.party.id}`}>{title.party.name}</Link>
                </td>
              </tr>
            ) : null}
            <tr>
              <td>Valor original</td>
              <td>{formatCents(title.originalAmountCents, title.currency)}</td>
            </tr>
            <tr>
              <td>Saldo aberto</td>
              <td>{formatCents(title.remainingCents, title.currency)}</td>
            </tr>
            <tr>
              <td>Competência</td>
              <td>{formatDateOnly(title.competenceDate)}</td>
            </tr>
            <tr>
              <td>Vencimento</td>
              <td>{formatDateOnly(title.dueDate)}</td>
            </tr>
            {title.notes ? (
              <tr>
                <td>Observações</td>
                <td>{title.notes}</td>
              </tr>
            ) : null}
            {title.status === "CANCELLED" && title.cancelReason ? (
              <tr>
                <td>Motivo do cancelamento</td>
                <td>{title.cancelReason}</td>
              </tr>
            ) : null}
          </tbody>
        </table>

        {title.status === "OPEN" && !hasActiveSettlement ? (
          <form action={cancelAction} style={{ marginTop: "1rem" }}>
            <label htmlFor="reason">Cancelar saldo remanescente — motivo</label>
            <input id="reason" name="reason" type="text" maxLength={500} required />
            <button type="submit" className="secondary">
              Cancelar título
            </button>
          </form>
        ) : null}

        <form action={deleteAction} style={{ marginTop: "1rem" }}>
          <label htmlFor="deleteReason">Remover das telas — motivo</label>
          <p className="muted">O histórico, as baixas, conciliações e anexos serão preservados para auditoria.</p>
          <input id="deleteReason" name="reason" type="text" maxLength={500} required />
          <button type="submit" className="secondary">
            Remover título
          </button>
        </form>
      </div>

      {installments.length > 0 ? (
        <div className="card">
          <div className="page-header" style={{ marginBottom: "0.5rem" }}>
            <h1>Parcelas</h1>
            {deleteInstallmentPlanAction ? (
              <form action={deleteInstallmentPlanAction} style={{ display: "flex", gap: "0.5rem" }}>
                <input
                  type="text"
                  name="reason"
                  placeholder="Motivo da remoção em massa"
                  maxLength={500}
                  required
                  style={{ width: "auto" }}
                />
                <button type="submit" className="secondary" style={{ marginTop: 0 }}>
                  Remover parcelamento ({installments.length} parcelas)
                </button>
              </form>
            ) : null}
          </div>
          <table>
            <thead>
              <tr>
                <th>Parcela</th>
                <th>Vencimento</th>
                <th>Saldo aberto</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {installments.map((installment) => (
                <tr key={installment.id} style={installment.id === title.id ? { fontWeight: 600 } : undefined}>
                  <td>
                    <Link href={`/entradas/${installment.id}`}>
                      {installment.installmentNumber} de {installment.installmentCount}
                    </Link>
                  </td>
                  <td>{formatDateOnly(installment.dueDate)}</td>
                  <td>{formatCents(installment.remainingCents, installment.currency)}</td>
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
        basePath="entradas"
        attachments={attachments}
        error={searchParams.erroAnexo}
        added={Boolean(searchParams.anexoAdicionado)}
        removed={Boolean(searchParams.anexoRemovido)}
      />

      <div className="card">
        <div className="page-header" style={{marginBottom:"0.5rem"}}><div><h1>Rateio</h1><p className="subtitle">Divida o valor entre categorias e centros de custo. A soma precisa fechar o valor original.</p></div></div>
        {searchParams.rateado ? <p className="success-box">Rateio atualizado.</p> : null}
        <AllocationForm action={replaceEntradaAllocationsAction.bind(null,title.id)} clearAction={clearEntradaAllocationsAction.bind(null,title.id)} categories={categories} costCenters={costCenters} error={searchParams.erroRateio} initial={title.allocations.map((item)=>({categoryId:item.categoryId,costCenterId:item.costCenterId,amount:(Number(item.amountCents)/100).toFixed(2).replace(".",",")}))}/>
      </div>

      <div className="card">
        <h1>Baixas</h1>
        {searchParams.erroDevolucao ? <p className="error">{searchParams.erroDevolucao}</p> : null}
        {title.settlements.length === 0 ? (
          <p className="muted">Nenhuma baixa registrada ainda.</p>
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
                const reverseAction = reverseEntradaSettlementAction.bind(null, title.id, settlement.id);
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
                        <div style={{display:"flex",gap:"0.5rem",flexWrap:"wrap"}}><ActionModal triggerLabel="Registrar devolução" title="Registrar devolução">
                          <form action={registerEntradaRefundAction.bind(null,title.id,settlement.id)}><label>Conta</label><select name="financialAccountId" defaultValue={settlement.financialAccountId} required>{accounts.map((account)=><option key={account.id} value={account.id}>{account.name}</option>)}</select><label>Valor (R$)</label><input name="amount" inputMode="decimal" required/><label>Data</label><input name="effectiveDate" type="date" defaultValue={toDateOnlyString(new Date())} required/><label>Motivo</label><input name="reason" required maxLength={500}/><button type="submit">Registrar devolução</button></form>
                        </ActionModal><form action={reverseAction} className="inline">
                          <input type="hidden" name="reason" value="Estornado pelo usuário" />
                          <button type="submit" className="secondary">
                            Estornar
                          </button>
                        </form></div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {title.settlements.some((item)=>item.refunds.length>0) ? <><h2 style={{marginTop:"1.5rem"}}>Devoluções</h2><table><thead><tr><th>Data</th><th>Baixa</th><th>Conta</th><th>Valor</th><th>Motivo</th><th></th></tr></thead><tbody>{title.settlements.flatMap((settlement)=>settlement.refunds.map((refund)=><tr key={refund.id} style={refund.reversedAt?{opacity:0.5}:undefined}><td>{formatDateOnly(refund.effectiveDate)}</td><td>{formatDateOnly(settlement.effectiveDate)}</td><td>{refund.financialAccount.name}</td><td>{formatCents(refund.amountCents)}</td><td>{refund.reason}</td><td>{refund.reversedAt?"Estornada":<form action={reverseEntradaRefundAction.bind(null,title.id,refund.id)} className="inline"><button type="submit" className="secondary">Estornar</button></form>}</td></tr>))}</tbody></table></> : null}
      </div>
      <div className="card">
        <h1>Histórico</h1>
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

  return <main>{infoAndHistory}</main>;
}
