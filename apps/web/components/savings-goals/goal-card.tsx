import Link from "next/link";
import type { SavingsGoalPace, SavingsGoalProgress } from "@ax-finance/domain";
import { formatCents } from "@/lib/currency";
import { formatDateOnly } from "@/lib/dates";
import { GoalBadge } from "./goal-visuals";
import { GoalProgressBar } from "./goal-progress-bar";
import { formatPercent } from "@/lib/percent";

export const PACE_LABEL: Record<SavingsGoalPace, string> = {
  REACHED: "Meta atingida",
  NO_DEADLINE: "Sem prazo",
  ON_TRACK: "No ritmo",
  BEHIND: "Abaixo do ritmo",
  OVERDUE: "Prazo vencido",
};

export interface GoalCardData {
  id: string;
  name: string;
  color: string;
  icon: string;
  status: string;
  targetDate: Date | null;
  targetAmountCents: bigint;
  balanceCents: bigint;
  progress: SavingsGoalProgress;
}

const MONTH_YEAR = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric", timeZone: "UTC" });

/** Linha de apoio: quanto falta e, com prazo, quanto guardar por mês para chegar lá. */
export function goalHint(goal: GoalCardData): string {
  const { progress } = goal;
  if (progress.reached) return progress.percent > 100 ? `Passou ${formatCents(goal.balanceCents - goal.targetAmountCents)} da meta` : "Você chegou lá!";
  if (progress.pace === "OVERDUE") return `Faltam ${formatCents(progress.remainingCents)} · prazo era ${formatDateOnly(goal.targetDate!)}`;
  if (progress.monthlySuggestionCents && goal.targetDate) {
    return `Guarde ${formatCents(progress.monthlySuggestionCents)}/mês até ${MONTH_YEAR.format(goal.targetDate).replace(". de ", "/").replace(" de ", "/")}`;
  }
  return `Faltam ${formatCents(progress.remainingCents)}`;
}

/** Cartão do cofrinho: ícone, nome, guardado de meta, barra enchendo e o que falta. `actions` fica no rodapé. */
export function GoalCard({ goal, actions, compact = false }: { goal: GoalCardData; actions?: React.ReactNode; compact?: boolean }) {
  const { progress } = goal;
  return (
    <article className={`card goal-card goal-color-${goal.color}${goal.status === "ARCHIVED" ? " is-archived" : ""}${compact ? " is-compact" : ""}`}>
      <header className="goal-card-header">
        <GoalBadge icon={goal.icon} color={goal.color} size={compact ? 36 : 44} />
        <div className="goal-card-title">
          <h2><Link href={`/cofrinhos/${goal.id}`}>{goal.name}</Link></h2>
          <span className={`goal-pace is-${progress.pace.toLowerCase().replace("_", "-")}`}>{goal.status === "ARCHIVED" ? "Arquivado" : PACE_LABEL[progress.pace]}</span>
        </div>
        <strong className="goal-card-percent">{formatPercent(progress.percent)}</strong>
      </header>
      <p className="goal-card-amounts"><strong>{formatCents(goal.balanceCents)}</strong> <span>de {formatCents(goal.targetAmountCents)}</span></p>
      <GoalProgressBar percent={progress.percent} barPercent={progress.barPercent} color={goal.color} reached={progress.reached} />
      <p className="goal-card-hint">{goalHint(goal)}</p>
      {actions ? <footer className="goal-card-actions">{actions}</footer> : null}
    </article>
  );
}
