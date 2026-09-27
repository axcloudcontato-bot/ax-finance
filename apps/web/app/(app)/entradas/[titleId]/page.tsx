import Link from "next/link";
import { redirect } from "next/navigation";
import { Landmark } from "lucide-react";
import {
  CompanyAccessDeniedError,
  EVENT_TYPE_LABEL,
  TitleNotFoundError,
  getTitle,
  listAuditEvents,
  listFinancialAccounts,
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
import {
  cancelEntradaAction,
  deleteEntradaAction,
  deleteEntradaInstallmentPlanAction,
  registerEntradaSettlementAction,
  reverseEntradaSettlementAction,
} from "../actions";

export default async function EntradaDetailPage({
  params,
  searchParams,
}: {
  params: { titleId: string };
  searchParams: { erro?: string; erroBaixa?: string; erroAnexo?: string; anexoAdicionado?: string; anexoRemovido?: string };
}) {
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

  const accounts = await listFinancialAccounts(user.id, company.id);
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
        <h1>Baixas</h1>
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
                        <form action={reverseAction} className="inline">
                          <input type="hidden" name="reason" value="Estornado pelo usuário" />
                          <button type="submit" className="secondary">
                            Estornar
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
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
