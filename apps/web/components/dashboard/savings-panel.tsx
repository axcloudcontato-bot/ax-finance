import Link from "next/link";
import type { listSavingsGoals } from "@ax-finance/domain";
import { formatCents } from "@/lib/currency";
import { GoalBadge } from "@/components/savings-goals/goal-visuals";
import { GoalProgressBar } from "@/components/savings-goals/goal-progress-bar";
import { formatPercent } from "@/lib/percent";

type SavingsSummary = Awaited<ReturnType<typeof listSavingsGoals>>;

/** Cofrinhos no painel: total guardado e os três mais perto da meta (os já atingidos vão para o fim). */
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
          {top.map((goal) => (
            <li key={goal.id}>
              <Link href={`/cofrinhos/${goal.id}`} className="dashboard-savings-head">
                <GoalBadge icon={goal.icon} color={goal.color} size={32} />
                <span><strong>{goal.name}</strong><small>{formatCents(goal.balanceCents)} de {formatCents(goal.targetAmountCents)}</small></span>
                <em>{formatPercent(goal.progress.percent)}</em>
              </Link>
              <GoalProgressBar percent={goal.progress.percent} barPercent={goal.progress.barPercent} color={goal.color} reached={goal.progress.reached} />
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
