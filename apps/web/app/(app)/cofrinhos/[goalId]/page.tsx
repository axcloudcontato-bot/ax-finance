import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SavingsGoalNotFoundError, getSavingsGoal, listFinancialAccounts } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { formatCents } from "@/lib/currency";
import { formatDateOnly } from "@/lib/dates";
import { ActionModal } from "@/components/ui/action-modal";
import { RowActionsMenu } from "@/components/ui/row-actions-menu";
import { SubmitButton } from "@/components/ui/submit-button";
import { PACE_LABEL, goalHint } from "@/components/savings-goals/goal-card";
import { GoalForm, GoalMoveForm } from "@/components/savings-goals/goal-forms";
import { GoalBadge } from "@/components/savings-goals/goal-visuals";
import { GoalProgressBar } from "@/components/savings-goals/goal-progress-bar";
import { formatPercent } from "@/lib/percent";
import {
  archiveSavingsGoalAction,
  deleteSavingsGoalAction,
  depositToSavingsGoalAction,
  reactivateSavingsGoalAction,
  reverseSavingsGoalMoveAction,
  updateSavingsGoalAction,
  withdrawFromSavingsGoalAction,
} from "../actions";

export default async function SavingsGoalPage(props: {
  params: Promise<{ goalId: string }>;
  searchParams: Promise<{ erro?: string; acao?: string; criado?: string; salvo?: string; guardado?: string; resgatado?: string; estornado?: string; reativado?: string }>;
}) {
  const [{ goalId }, searchParams] = await Promise.all([props.params, props.searchParams]);
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await requirePrimaryCompany(user.id);

  let goal: Awaited<ReturnType<typeof getSavingsGoal>>;
  try {
    goal = await getSavingsGoal(user.id, company.id, goalId);
  } catch (error) {
    if (error instanceof SavingsGoalNotFoundError) notFound();
    throw error;
  }
  const accounts = (await listFinancialAccounts(user.id, company.id)).map(({ id, name }) => ({ id, name }));
  const { progress } = goal;
  const active = goal.status === "ACTIVE";
  const refreshKey = [searchParams.erro, searchParams.salvo, searchParams.guardado, searchParams.resgatado, searchParams.estornado].join("|");
  const failed = (action: string) => Boolean(searchParams.erro) && searchParams.acao === action;
  const badge = <GoalBadge icon={goal.icon} color={goal.color} size={30} />;
  const hasMoves = goal.moves.length > 0;

  return (
    <main className="wide savings-page">
      <p className="breadcrumb"><Link href="/cofrinhos">← Cofrinhos</Link></p>
      <div className="page-header goal-detail-header">
        <div className="goal-detail-title">
          <GoalBadge icon={goal.icon} color={goal.color} size={56} />
          <div>
            <h1>{goal.name}</h1>
            <p className="subtitle">
              <span className={`goal-pace is-${progress.pace.toLowerCase().replace("_", "-")}`}>{active ? PACE_LABEL[progress.pace] : "Arquivado"}</span>
              {goal.targetDate ? <> · prazo {formatDateOnly(goal.targetDate)}</> : null}
            </p>
          </div>
        </div>
        <div className="goal-detail-actions">
          {active ? (
            <>
              <ActionModal key={`guardar-${refreshKey}`} triggerLabel="Guardar" triggerClassName="button-link workspace-primary-action" title={`Guardar em ${goal.name}`} icon={badge} initiallyOpen={failed("guardar")}>
                {failed("guardar") ? <p className="error">{searchParams.erro}</p> : null}
                <GoalMoveForm action={depositToSavingsGoalAction.bind(null, goal.id, "detalhe")} accounts={accounts} direction="DEPOSIT" balanceCents={goal.balanceCents} defaultAccountId={goal.defaultSourceAccountId} today={goal.today} idPrefix="guardar" />
              </ActionModal>
              <ActionModal key={`resgatar-${refreshKey}`} triggerLabel="Resgatar" title={`Resgatar de ${goal.name}`} icon={badge} initiallyOpen={failed("resgatar")}>
                {failed("resgatar") ? <p className="error">{searchParams.erro}</p> : null}
                {goal.balanceCents > BigInt(0)
                  ? <GoalMoveForm action={withdrawFromSavingsGoalAction.bind(null, goal.id, "detalhe")} accounts={accounts} direction="WITHDRAW" balanceCents={goal.balanceCents} defaultAccountId={goal.defaultSourceAccountId} today={goal.today} idPrefix="resgatar" />
                  : <p className="muted">Este cofrinho ainda está vazio.</p>}
              </ActionModal>
            </>
          ) : null}
          <RowActionsMenu>
            {active ? (
              <ActionModal key={`editar-${refreshKey}`} triggerLabel="Editar" title={`Editar cofrinho — ${goal.name}`} size="wide" icon={badge} initiallyOpen={failed("editar")}>
                {failed("editar") ? <p className="error">{searchParams.erro}</p> : null}
                <GoalForm action={updateSavingsGoalAction.bind(null, goal.id, "detalhe")} accounts={accounts} idPrefix="editar-cofrinho" submitLabel="Salvar alterações" defaults={goal} />
              </ActionModal>
            ) : null}
            {active ? (
              <ActionModal key={`arquivar-${refreshKey}`} triggerLabel="Arquivar" title={`Arquivar ${goal.name}`} icon={badge}>
                <form action={archiveSavingsGoalAction.bind(null, goal.id)}>
                  {goal.balanceCents > BigInt(0) ? (
                    <>
                      <p className="subtitle">O cofrinho ainda tem <strong>{formatCents(goal.balanceCents)}</strong>. Esse valor volta para a conta escolhida e o cofrinho é arquivado. O histórico continua disponível.</p>
                      <label htmlFor="arquivar-conta">Devolver para a conta</label>
                      <select id="arquivar-conta" name="withdrawToAccountId" required defaultValue={goal.defaultSourceAccountId ?? (accounts.length === 1 ? accounts[0]!.id : "")}>
                        <option value="" disabled>Selecione</option>
                        {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                      </select>
                    </>
                  ) : <p className="subtitle">O cofrinho sai da lista de ativos. O histórico continua disponível e você pode reativá-lo depois.</p>}
                  <div className="form-actions"><SubmitButton>{goal.balanceCents > BigInt(0) ? "Resgatar tudo e arquivar" : "Arquivar"}</SubmitButton></div>
                </form>
              </ActionModal>
            ) : (
              <form action={reactivateSavingsGoalAction.bind(null, goal.id)} className="inline"><SubmitButton className="secondary">Reativar</SubmitButton></form>
            )}
            {!hasMoves ? (
              <ActionModal triggerLabel="Excluir" title={`Excluir ${goal.name}`} icon={badge}>
                <form action={deleteSavingsGoalAction.bind(null, goal.id)}>
                  <p className="subtitle">O cofrinho nunca teve movimento e será excluído de vez.</p>
                  <div className="form-actions"><SubmitButton className="danger-button">Excluir cofrinho</SubmitButton></div>
                </form>
              </ActionModal>
            ) : null}
          </RowActionsMenu>
        </div>
      </div>

      {searchParams.erro && !searchParams.acao ? <p className="error">{searchParams.erro}</p> : null}
      {searchParams.criado ? <p className="success-box">Cofrinho criado. Agora é só ir guardando.</p> : null}
      {searchParams.salvo ? <p className="success-box">Cofrinho atualizado.</p> : null}
      {searchParams.guardado ? <p className="success-box">Valor guardado.</p> : null}
      {searchParams.resgatado ? <p className="success-box">Valor resgatado.</p> : null}
      {searchParams.estornado ? <p className="success-box">Movimento estornado.</p> : null}
      {searchParams.reativado ? <p className="success-box">Cofrinho reativado.</p> : null}

      <section className={`card goal-detail-progress goal-color-${goal.color}`} aria-label="Progresso da meta">
        <div className="goal-detail-numbers">
          <div><span>Guardado</span><strong>{formatCents(goal.balanceCents)}</strong></div>
          <div className="goal-detail-percent"><strong>{formatPercent(progress.percent)}</strong><span>da meta de {formatCents(goal.targetAmountCents)}</span></div>
        </div>
        <GoalProgressBar percent={progress.percent} barPercent={progress.barPercent} color={goal.color} reached={progress.reached} large />
        <div className="goal-detail-marks" aria-hidden="true"><span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span></div>
        <dl className="goal-detail-facts">
          <div><dt>Falta</dt><dd>{formatCents(progress.remainingCents)}</dd></div>
          <div><dt>Prazo</dt><dd>{goal.targetDate ? formatDateOnly(goal.targetDate) : "Sem prazo"}</dd></div>
          <div><dt>Por mês até o prazo</dt><dd>{progress.monthlySuggestionCents ? formatCents(progress.monthlySuggestionCents) : "—"}</dd></div>
          <div><dt>Conta padrão</dt><dd>{goal.defaultSourceAccount?.name ?? "Escolher a cada vez"}</dd></div>
        </dl>
        {progress.reached || progress.pace === "OVERDUE" ? <p className="goal-card-hint">{goalHint(goal)}</p> : null}
      </section>

      <section className="card">
        <div className="workspace-card-heading"><div><h2>Histórico</h2><p>Cada vez que guardou ou resgatou. Estornar desfaz o movimento e devolve o valor.</p></div></div>
        {!hasMoves ? <p className="muted">Nenhum movimento ainda.</p> : (
          <div className="table-scroll">
            <table className="workspace-table goal-moves">
              <thead><tr><th>Data</th><th>Movimento</th><th>Conta</th><th className="money">Valor</th><th><span className="sr-only">Ações</span></th></tr></thead>
              <tbody>
                {goal.moves.map((move) => (
                  <tr key={move.id} className={move.reversedAt ? "is-reversed" : undefined}>
                    <td>{formatDateOnly(move.date)}</td>
                    <td>
                      <span className={`goal-move-kind is-${move.kind === "DEPOSIT" ? "deposit" : "withdraw"}`}>{move.kind === "DEPOSIT" ? "Guardado" : "Resgatado"}</span>
                      {move.reversedAt ? <span className="workspace-status">Estornado</span> : null}
                      {move.description && !move.description.startsWith("Guardado no cofrinho") && !move.description.startsWith("Resgatado do cofrinho") ? <small className="muted goal-move-note">{move.description}</small> : null}
                    </td>
                    <td>{move.account.name}</td>
                    <td className={`money ${move.kind === "DEPOSIT" ? "positive" : "negative"}`}>{move.kind === "DEPOSIT" ? "+" : "−"} {formatCents(move.amountCents)}</td>
                    <td>
                      {move.reversedAt ? null : (
                        <RowActionsMenu>
                          <ActionModal triggerLabel="Estornar" title="Estornar movimento" icon={badge}>
                            <form action={reverseSavingsGoalMoveAction.bind(null, goal.id, move.id)}>
                              <p className="subtitle">{move.kind === "DEPOSIT" ? `Os ${formatCents(move.amountCents)} saem do cofrinho e voltam para ${move.account.name}.` : `Os ${formatCents(move.amountCents)} voltam para o cofrinho e saem de ${move.account.name}.`}</p>
                              <label htmlFor={`motivo-${move.id}`}>Motivo</label>
                              <input id={`motivo-${move.id}`} name="reason" type="text" maxLength={500} placeholder="Ex.: lançado em duplicidade" />
                              <div className="form-actions"><SubmitButton className="secondary">Estornar</SubmitButton></div>
                            </form>
                          </ActionModal>
                        </RowActionsMenu>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
