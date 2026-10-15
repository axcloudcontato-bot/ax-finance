import Link from "next/link";
import type { listSavingsGoals } from "@ax-finance/domain";
import { formatCents } from "@/lib/currency";
import { formatDateOnly } from "@/lib/dates";
import { formatPercent } from "@/lib/percent";
import { GoalProgressBar } from "./goal-progress-bar";
import { PACE_LABEL, goalHint } from "./goal-card";

type SavingsGoal = Awaited<ReturnType<typeof listSavingsGoals>>["goals"][number];

/**
 * Resumo do cofrinho para o modal de detalhes (Painel e lista de cofrinhos): ritmo, guardado,
 * barra, fatos da meta e atalhos. O histórico completo continua na página do cofrinho.
 */
export function GoalDetailSummary({ goal, showAllLink = false }: { goal: SavingsGoal; showAllLink?: boolean }) {
  const { progress } = goal;
  const archived = goal.status === "ARCHIVED";
  return (
    <div className={`dashboard-savings-detail goal-color-${goal.color}`}>
      <p className="subtitle"><span className={`goal-pace is-${progress.pace.toLowerCase().replace("_", "-")}`}>{archived ? "Arquivado" : PACE_LABEL[progress.pace]}</span></p>
      <div className="goal-detail-numbers">
        <div><span>Guardado</span><strong>{formatCents(goal.balanceCents)}</strong></div>
        <div className="goal-detail-percent"><strong>{formatPercent(progress.percent)}</strong><span>da meta de {formatCents(goal.targetAmountCents)}</span></div>
      </div>
      <GoalProgressBar percent={progress.percent} barPercent={progress.barPercent} color={goal.color} reached={progress.reached} large />
      <dl className="goal-detail-facts">
        <div><dt>Falta</dt><dd>{formatCents(progress.remainingCents)}</dd></div>
        <div><dt>Prazo</dt><dd>{goal.targetDate ? formatDateOnly(goal.targetDate) : "Sem prazo"}</dd></div>
        <div><dt>Por mês até o prazo</dt><dd>{progress.monthlySuggestionCents ? formatCents(progress.monthlySuggestionCents) : "—"}</dd></div>
        <div><dt>Conta padrão</dt><dd>{goal.defaultSourceAccount?.name ?? "Escolher a cada vez"}</dd></div>
      </dl>
      <p className="goal-card-hint">{goalHint(goal)}</p>
      <div className="form-actions">
        <Link href={`/cofrinhos/${goal.id}`} className="button-link workspace-primary-action">{showAllLink ? "Abrir cofrinho" : "Ver histórico completo"}</Link>
        {showAllLink ? <Link href="/cofrinhos" className="button-link">Todos os cofrinhos</Link> : null}
      </div>
    </div>
  );
}
