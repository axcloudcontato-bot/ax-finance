import Link from "next/link";
import type { listSavingsGoals } from "@ax-finance/domain";
import { formatCents } from "@/lib/currency";
import { formatDateOnly } from "@/lib/dates";
import { GoalBadge } from "@/components/savings-goals/goal-visuals";
import { GoalProgressBar } from "@/components/savings-goals/goal-progress-bar";
import { PACE_LABEL, goalHint } from "@/components/savings-goals/goal-card";
import { ActionModal } from "@/components/ui/action-modal";
import { formatPercent } from "@/lib/percent";

type SavingsSummary = Awaited<ReturnType<typeof listSavingsGoals>>;

/**
 * Cofrinhos no painel: total guardado e os três mais perto da meta (os já atingidos vão para o fim).
 * Cada cartão abre o detalhe do cofrinho num painel que cresce a partir dele.
 */
export function SavingsPanel({ savings }: { savings: SavingsSummary }) {
  const active = savings.goals.filter((goal) => goal.status === "ACTIVE");
  const top = [...active]
    .sort((left, right) => Number(left.progress.reached) - Number(right.progress.reached) || right.progress.percent - left.progress.percent)
    .slice(0, 3);
  return (
    <section className="card dashboard-insight-section dashboard-savings">
      <div className="dashboard-section-heading">
        <div>
          <h2>Cofrinhos</h2>
          <p>{active.length === 0 ? "Separe dinheiro para seus objetivos e acompanhe cada meta." : <>Guardado <strong>{formatCents(savings.totals.savedCents)}</strong> de {formatCents(savings.totals.targetCents)} · {savings.totals.reachedCount} {savings.totals.reachedCount === 1 ? "meta atingida" : "metas atingidas"}</>}</p>
        </div>
        <Link href="/cofrinhos" className="insight-link">{active.length === 0 ? "Criar cofrinho" : "Ver cofrinhos"}</Link>
      </div>
      {top.length > 0 ? (
        <ul className="dashboard-savings-list">
          {top.map((goal) => {
            const { progress } = goal;
            return (
              <li key={goal.id}>
                <ActionModal
                  triggerClassName="dashboard-savings-trigger"
                  title={goal.name}
                  icon={<GoalBadge icon={goal.icon} color={goal.color} size={30} />}
                  triggerLabel={
                    <>
                      <span className="dashboard-savings-head">
                        <GoalBadge icon={goal.icon} color={goal.color} size={32} />
                        <span><strong>{goal.name}</strong><small>{formatCents(goal.balanceCents)} de {formatCents(goal.targetAmountCents)}</small></span>
                        <em>{formatPercent(progress.percent)}</em>
                      </span>
                      <GoalProgressBar percent={progress.percent} barPercent={progress.barPercent} color={goal.color} reached={progress.reached} />
                    </>
                  }
                >
                  <div className={`dashboard-savings-detail goal-color-${goal.color}`}>
                    <p className="subtitle"><span className={`goal-pace is-${progress.pace.toLowerCase().replace("_", "-")}`}>{PACE_LABEL[progress.pace]}</span></p>
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
                      <Link href={`/cofrinhos/${goal.id}`} className="button-link workspace-primary-action">Abrir cofrinho</Link>
                      <Link href="/cofrinhos" className="button-link">Todos os cofrinhos</Link>
                    </div>
                  </div>
                </ActionModal>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
