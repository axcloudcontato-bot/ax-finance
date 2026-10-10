import Link from "next/link";
import { redirect } from "next/navigation";
import { listActiveCategories, listDebts, listFinancialAccounts } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { formatCents } from "@/lib/currency";
import { formatDateOnly, todayDateOnlyString } from "@/lib/dates";
import { ActionModal } from "@/components/ui/action-modal";
import { SubmitButton } from "@/components/ui/submit-button";
import { DebtPreview } from "@/components/wealth/debt-preview";
import { createDebtAction } from "./actions";
import { DEBT_KIND_LABEL } from "@/lib/wealth-labels";

const ZERO = BigInt(0);

export default async function DebtsPage(props: { searchParams: Promise<{ erro?: string; acao?: string; arquivada?: string; excluida?: string }> }) {
  const searchParams = await props.searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await requirePrimaryCompany(user.id);

  const [{ debts, totals }, categories, accounts] = await Promise.all([
    listDebts(user.id, company.id),
    listActiveCategories(user.id, company.id),
    listFinancialAccounts(user.id, company.id),
  ]);
  const spending = categories.filter((category) => category.nature !== "OPERATING_REVENUE");
  // sugere a categoria de financiamento, se houver
  const suggestedCategory = spending.find((category) => category.nature === "FINANCING")?.id ?? "";
  const failed = Boolean(searchParams.erro) && searchParams.acao === "nova";

  return (
    <main className="wide wealth-page">
      <div className="page-header">
        <div>
          <h1>Dívidas e financiamentos</h1>
          <p className="subtitle">Cadastre o contrato uma vez: as parcelas que faltam viram saídas e o saldo devedor diminui a cada parcela paga.</p>
        </div>
        <ActionModal triggerLabel="+ Nova dívida" triggerClassName="button-link workspace-primary-action" title="Nova dívida ou financiamento" size="wide" initiallyOpen={failed}>
          {failed ? <p className="error">{searchParams.erro}</p> : null}
          {spending.length === 0 ? <p className="muted">Cadastre uma categoria de despesa ou de financiamento antes, para classificar as parcelas.</p> : (
            <form action={createDebtAction}>
              <div className="form-grid">
                <div className="span-2"><label htmlFor="debt-name">Nome</label><input id="debt-name" name="name" type="text" required maxLength={120} placeholder="Ex.: Financiamento do carro, Empréstimo pessoal" /></div>
                <div><label htmlFor="debt-kind">Tipo</label><select id="debt-kind" name="kind" defaultValue="FINANCING">{Object.entries(DEBT_KIND_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
                <div><label htmlFor="debt-lender">Banco ou credor (opcional)</label><input id="debt-lender" name="lender" type="text" maxLength={120} /></div>
                <div><label htmlFor="debt-principal">Valor contratado (R$)</label><input id="debt-principal" name="principal" type="text" inputMode="decimal" placeholder="0,00" required /></div>
                <div><label htmlFor="debt-rate">Juros ao mês (%)</label><input id="debt-rate" name="monthlyRate" type="text" placeholder="Ex.: 1,89" required /></div>
                <div><label htmlFor="debt-count">Número de parcelas</label><input id="debt-count" name="installmentCount" type="number" min={1} max={600} required /></div>
                <div><label htmlFor="debt-paid">Parcelas já pagas</label><input id="debt-paid" name="paidBeforeCount" type="number" min={0} max={599} defaultValue={0} /><p className="field-note">Para um contrato em andamento. Essas não viram lançamento.</p></div>
                <div><label htmlFor="debt-first">Vencimento da 1ª parcela do contrato</label><input id="debt-first" name="firstDueDate" type="date" required defaultValue={todayDateOnlyString()} /></div>
                <div><label htmlFor="debt-system">Tabela</label><select id="debt-system" name="amortization" defaultValue="PRICE"><option value="PRICE">Price (parcela fixa)</option><option value="SAC">SAC (parcela que diminui)</option></select></div>
                <div><label htmlFor="debt-category">Categoria das parcelas</label><select id="debt-category" name="categoryId" required defaultValue={suggestedCategory}><option value="" disabled>Selecione</option>{spending.map((category) => <option key={category.id} value={category.id}>{category.parentId ? "↳ " : ""}{category.name}</option>)}</select></div>
                <div><label htmlFor="debt-account">Conta de onde sai (opcional)</label><select id="debt-account" name="expectedAccountId" defaultValue=""><option value="">Não informar</option>{accounts.filter((account) => account.status === "ACTIVE").map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></div>
                <div className="span-2"><DebtPreview /></div>
              </div>
              <div className="form-actions"><SubmitButton>Cadastrar e lançar as parcelas</SubmitButton></div>
            </form>
          )}
        </ActionModal>
      </div>

      {searchParams.erro && !failed ? <p className="error">{searchParams.erro}</p> : null}
      {searchParams.arquivada ? <p className="success-box">Dívida arquivada. As parcelas lançadas continuam em Saídas.</p> : null}
      {searchParams.excluida ? <p className="success-box">Dívida excluída, junto com as parcelas em aberto.</p> : null}

      <section className="workspace-metrics" aria-label="Resumo das dívidas">
        <div className="workspace-metric workspace-metric-primary"><span className="workspace-metric-label">Saldo devedor</span><strong>{formatCents(totals.balanceCents)}</strong><span className="workspace-metric-detail">Quanto falta amortizar, sem os juros futuros</span></div>
        <div className="workspace-metric"><span className="workspace-metric-label">Próximas parcelas</span><strong>{formatCents(totals.monthlyCents)}</strong><span className="workspace-metric-detail">Soma da próxima parcela de cada dívida</span></div>
        <div className="workspace-metric"><span className="workspace-metric-label">Juros que ainda vai pagar</span><strong className={totals.remainingInterestCents > ZERO ? "negative" : undefined}>{formatCents(totals.remainingInterestCents)}</strong><span className="workspace-metric-detail">Se pagar tudo em dia até o fim</span></div>
      </section>

      {debts.length === 0 ? (
        <div className="card"><div className="workspace-empty"><strong>Nenhuma dívida cadastrada</strong><p>Financiamento, empréstimo ou cheque especial: cadastre e acompanhe o saldo devedor, os juros e as parcelas. Elas aparecem em Saídas e no calendário.</p></div></div>
      ) : (
        <div className="card-tiles">
          {debts.map((debt) => (
            <article key={debt.id} className="card card-tile debt-card">
              <header className="card-tile-header">
                <div className="card-tile-title">
                  <h2><Link href={`/dividas/${debt.id}`}>{debt.name}</Link></h2>
                  <span className="muted">{DEBT_KIND_LABEL[debt.kind]}{debt.lender ? ` · ${debt.lender}` : ""} · {(debt.monthlyRateBps / 100).toLocaleString("pt-BR")}% a.m.</span>
                </div>
              </header>
              <div className="debt-progress" role="img" aria-label={`${Math.round(debt.paidPercent)}% amortizado`}><span style={{ width: `${Math.min(100, debt.paidPercent)}%` }} /></div>
              <p className="debt-progress-legend"><span>{debt.paidCount} de {debt.installmentCount} parcelas pagas</span><span>{Math.round(debt.paidPercent)}% quitado</span></p>
              <dl className="card-tile-facts">
                <div><dt>Saldo devedor</dt><dd>{formatCents(debt.balanceCents)}</dd><small>de {formatCents(debt.principalCents)} contratados</small></div>
                <div>
                  <dt>Próxima parcela</dt>
                  {debt.nextInstallment ? <><dd className={debt.nextInstallment.overdue ? "negative" : undefined}>{formatCents(debt.nextInstallment.amountCents)}</dd><small>{debt.nextInstallment.overdue ? "venceu" : "vence"} em {formatDateOnly(debt.nextInstallment.dueDate)}</small></> : <><dd>—</dd><small>Nenhuma em aberto</small></>}
                </div>
              </dl>
              {debt.overdueCount > 0 ? <p className="credit-card-warning">{debt.overdueCount} {debt.overdueCount === 1 ? "parcela vencida" : "parcelas vencidas"}</p> : null}
              <footer className="card-tile-actions">
                {debt.nextInstallment ? <Link href={`/saidas/${debt.nextInstallment.titleId}`} className="button-link workspace-primary-action">Pagar parcela</Link> : null}
                <Link href={`/dividas/${debt.id}`} className="button-link">Ver tabela</Link>
              </footer>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
