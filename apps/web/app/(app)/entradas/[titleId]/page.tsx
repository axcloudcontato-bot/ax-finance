import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CompanyAccessDeniedError,
  TitleNotFoundError,
  getTitle,
  listFinancialAccounts,
  listInstallments,
} from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { formatCents } from "@/lib/currency";
import { formatDateOnly } from "@/lib/dates";
import { TitleStatusBadge } from "@/components/titles/title-status-badge";
import { SettlementForm } from "@/components/titles/settlement-form";
import {
  cancelEntradaAction,
  registerEntradaSettlementAction,
  reverseEntradaSettlementAction,
} from "../actions";

export default async function EntradaDetailPage({
  params,
  searchParams,
}: {
  params: { titleId: string };
  searchParams: { erro?: string };
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
  const hasActiveSettlement = title.settlements.some((settlement) => !settlement.reversedAt);
  const registerSettlementAction = registerEntradaSettlementAction.bind(null, title.id);
  const cancelAction = cancelEntradaAction.bind(null, title.id);
  const showSettlementForm = title.status !== "CANCELLED" && title.remainingCents > BigInt(0);

  const infoAndHistory = (
    <>
      <div className="card">
        <div className="page-header" style={{ marginBottom: "0.5rem" }}>
          <h1>{title.description}</h1>
          <TitleStatusBadge status={title.status} dueDate={title.dueDate} />
        </div>
        <p className="subtitle">
          {title.category.parentId ? "↳ " : ""}
          {title.category.name}
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
      </div>

      {installments.length > 0 ? (
        <div className="card">
          <h1>Parcelas</h1>
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
    </>
  );

  return (
    <main className={showSettlementForm ? "wide" : undefined}>
      {showSettlementForm ? (
        <div className="split">
          <div>{infoAndHistory}</div>
          <div>
            <SettlementForm action={registerSettlementAction} accounts={accounts} />
          </div>
        </div>
      ) : (
        infoAndHistory
      )}
    </main>
  );
}
