import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DebtNotFoundError, getDebt } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { formatCents } from "@/lib/currency";
import { ActionModal } from "@/components/ui/action-modal";
import { RowActionsMenu } from "@/components/ui/row-actions-menu";
import { SubmitButton } from "@/components/ui/submit-button";
import { deleteDebtAction, setDebtArchivedAction } from "../actions";
import { DEBT_KIND_LABEL } from "@/lib/wealth-labels";
import { DebtMetrics, DebtScheduleTable } from "@/components/wealth/debt-schedule";


export default async function DebtPage(props: { params: Promise<{ debtId: string }>; searchParams: Promise<{ erro?: string; criada?: string; reativada?: string }> }) {
  const [{ debtId }, searchParams] = await Promise.all([props.params, props.searchParams]);
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await requirePrimaryCompany(user.id);

  let debt: Awaited<ReturnType<typeof getDebt>>;
  try {
    debt = await getDebt(user.id, company.id, debtId);
  } catch (error) {
    if (error instanceof DebtNotFoundError) notFound();
    throw error;
  }
  const anyPaid = debt.hasPaymentHistory;

  return (
    <main className="wide wealth-page">
      <p className="breadcrumb"><Link href="/dividas">← Dívidas</Link></p>
      <div className="page-header">
        <div>
          <h1>{debt.name}</h1>
          <p className="subtitle">
            {DEBT_KIND_LABEL[debt.kind]}{debt.lender ? ` · ${debt.lender}` : ""} · {formatCents(debt.principalCents)} em {debt.installmentCount}x · {(debt.monthlyRateBps / 100).toLocaleString("pt-BR")}% a.m. · tabela {debt.amortization === "PRICE" ? "Price" : "SAC"} · categoria {debt.categoryName}
            {debt.status === "ARCHIVED" ? " · arquivada" : ""}
          </p>
        </div>
        <div className="budget-year-actions">
          {debt.nextInstallment && debt.status === "ACTIVE" ? <Link href={`/saidas/${debt.nextInstallment.titleId}`} className="button-link workspace-primary-action">Pagar parcela {debt.nextInstallment.number}</Link> : null}
          <RowActionsMenu>
            {debt.status === "ACTIVE"
              ? <form action={setDebtArchivedAction.bind(null, debt.id, true)} className="inline"><SubmitButton className="secondary">Arquivar</SubmitButton></form>
              : <form action={setDebtArchivedAction.bind(null, debt.id, false)} className="inline"><SubmitButton className="secondary">Reativar</SubmitButton></form>}
            {!anyPaid ? (
              <ActionModal triggerLabel="Excluir" title={`Excluir ${debt.name}`}>
                <form action={deleteDebtAction.bind(null, debt.id)}>
                  <p className="subtitle">Nenhuma parcela lançada foi paga. A dívida e as parcelas em aberto saem do sistema (ficam no histórico de auditoria).</p>
                  <div className="form-actions"><SubmitButton className="danger-button">Excluir dívida</SubmitButton></div>
                </form>
              </ActionModal>
            ) : null}
          </RowActionsMenu>
        </div>
      </div>

      {searchParams.erro ? <p className="error">{searchParams.erro}</p> : null}
      {searchParams.criada ? <p className="success-box">Dívida cadastrada. As parcelas em aberto já estão em Saídas e no calendário.</p> : null}
      {searchParams.reativada ? <p className="success-box">Dívida reativada.</p> : null}
      {debt.status === "ARCHIVED" ? <p className="field-note">O saldo desta dívida arquivada continua no patrimônio. Arquivamento não representa quitação.</p> : null}
      {debt.contractWarningsCount > 0 ? <p className="error">Há {debt.contractWarningsCount} parcela(s) com valor alterado, cancelada(s) ou removida(s). O saldo contratual foi preservado; confira os lançamentos e o extrato do credor antes de usar a previsão de pagamentos.</p> : null}
      <p className="field-note">Posição pelos pagamentos efetivados até hoje. Baixas parciais e descontos são rateados proporcionalmente entre juros e amortização da parcela; multas e tarifas adicionais não amortizam o contrato. Antecipações seguem a tabela contratada, sem recalcular juros: confira condições de liquidação com o credor.</p>

      <DebtMetrics debt={debt} />

      <section className="card">
        <div className="workspace-card-heading"><div><h2>Tabela de amortização</h2><p>Cada parcela = juros do mês sobre o saldo + amortização. Pagar a parcela em Saídas atualiza esta tabela.</p></div></div>
        <DebtScheduleTable debt={debt} />
      </section>
    </main>
  );
}
