import Link from "next/link";
import { redirect } from "next/navigation";
import { listFinancialAccounts, listSavingsGoals } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { formatCents } from "@/lib/currency";
import { ActionModal } from "@/components/ui/action-modal";
import { GoalCard } from "@/components/savings-goals/goal-card";
import { GoalForm, GoalMoveForm } from "@/components/savings-goals/goal-forms";
import { GoalBadge } from "@/components/savings-goals/goal-visuals";
import { createSavingsGoalAction, depositToSavingsGoalAction, withdrawFromSavingsGoalAction } from "./actions";

const FILTERS = [
  { key: "ativos", label: "Ativos" },
  { key: "concluidos", label: "Meta atingida" },
  { key: "arquivados", label: "Arquivados" },
] as const;

export default async function SavingsGoalsPage(props: {
  searchParams: Promise<{ erro?: string; acao?: string; cofrinho?: string; filtro?: string; guardado?: string; resgatado?: string; arquivado?: string; excluido?: string }>;
}) {
  const searchParams = await props.searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await requirePrimaryCompany(user.id);

  const [{ goals, totals, today }, accounts] = await Promise.all([
    listSavingsGoals(user.id, company.id, { includeArchived: true }),
    listFinancialAccounts(user.id, company.id),
  ]);
  const accountOptions = accounts.map(({ id, name }) => ({ id, name }));
  const filter = FILTERS.some((item) => item.key === searchParams.filtro) ? searchParams.filtro! : "ativos";
  const visible = goals.filter((goal) =>
    filter === "arquivados" ? goal.status === "ARCHIVED" : filter === "concluidos" ? goal.status === "ACTIVE" && goal.progress.reached : goal.status === "ACTIVE",
  );
  const counts = {
    ativos: goals.filter((goal) => goal.status === "ACTIVE").length,
    concluidos: totals.reachedCount,
    arquivados: goals.filter((goal) => goal.status === "ARCHIVED").length,
  };
  const overall = totals.targetCents > BigInt(0) ? Number((totals.savedCents * BigInt(1000)) / totals.targetCents) / 10 : 0;
  const refreshKey = [searchParams.erro, searchParams.guardado, searchParams.resgatado, searchParams.arquivado, searchParams.excluido].join("|");
  const failed = (goalId: string, action: string) => Boolean(searchParams.erro) && searchParams.cofrinho === goalId && searchParams.acao === action;
  const movedName = goals.find((goal) => goal.id === (searchParams.guardado ?? searchParams.resgatado))?.name;

  return (
    <main className="wide savings-page">
      <div className="page-header">
        <div><h1>Cofrinhos</h1><p className="subtitle">Separe dinheiro para cada objetivo e acompanhe a barra enchendo até a meta.</p></div>
        <ActionModal
          key={`novo-${refreshKey}`}
          triggerLabel="+ Novo cofrinho"
          triggerClassName="button-link workspace-primary-action"
          title="Novo cofrinho"
          size="wide"
          icon={<GoalBadge icon="piggy" color="blue" size={30} />}
          initiallyOpen={Boolean(searchParams.erro) && searchParams.acao === "novo"}
        >
          {searchParams.erro && searchParams.acao === "novo" ? <p className="error">{searchParams.erro}</p> : null}
          <GoalForm action={createSavingsGoalAction} accounts={accountOptions} idPrefix="novo-cofrinho" />
        </ActionModal>
      </div>

      {searchParams.erro && !searchParams.acao ? <p className="error">{searchParams.erro}</p> : null}
      {searchParams.guardado && movedName ? <p className="success-box">Valor guardado em {movedName}.</p> : null}
      {searchParams.resgatado && movedName ? <p className="success-box">Valor resgatado de {movedName}.</p> : null}
      {searchParams.arquivado ? <p className="success-box">Cofrinho arquivado.</p> : null}
      {searchParams.excluido ? <p className="success-box">Cofrinho excluído.</p> : null}

      <section className="workspace-metrics savings-metrics" aria-label="Resumo dos cofrinhos">
        <div className="workspace-metric workspace-metric-primary">
          <span className="workspace-metric-label">Guardado nos cofrinhos</span>
          <strong>{formatCents(totals.savedCents)}</strong>
          <span className="workspace-metric-detail">Fora do saldo disponível das contas</span>
        </div>
        <div className="workspace-metric">
          <span className="workspace-metric-label">Soma das metas</span>
          <strong>{formatCents(totals.targetCents)}</strong>
          <span className="workspace-metric-detail">{overall.toLocaleString("pt-BR")}% do total já guardado</span>
        </div>
        <div className="workspace-metric">
          <span className="workspace-metric-label">Cofrinhos ativos</span>
          <strong>{totals.activeCount}</strong>
          <span className="workspace-metric-detail">{totals.reachedCount} com a meta atingida</span>
        </div>
      </section>

      {goals.length > 0 ? (
        <nav className="filters" aria-label="Filtrar cofrinhos">
          {FILTERS.map((item) => (
            <Link key={item.key} href={item.key === "ativos" ? "/cofrinhos" : `/cofrinhos?filtro=${item.key}`} className={filter === item.key ? "active" : undefined} aria-current={filter === item.key ? "page" : undefined}>
              {item.label} <span className="muted">{counts[item.key]}</span>
            </Link>
          ))}
        </nav>
      ) : null}

      {goals.length === 0 ? (
        <div className="card">
          <div className="workspace-empty savings-empty">
            <GoalBadge icon="piggy" color="blue" size={56} />
            <strong>Nenhum cofrinho ainda</strong>
            <p>Crie um cofrinho para cada objetivo, como viagem, reserva de emergência ou impostos, defina a meta e vá guardando. O valor sai da conta e fica separado até você resgatar.</p>
          </div>
        </div>
      ) : visible.length === 0 ? (
        <div className="card"><div className="workspace-empty"><strong>Nada por aqui</strong><p>{filter === "arquivados" ? "Nenhum cofrinho arquivado." : filter === "concluidos" ? "Nenhum cofrinho chegou na meta ainda." : "Todos os cofrinhos estão arquivados."}</p></div></div>
      ) : (
        <div className="goal-grid">
          {visible.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              actions={goal.status === "ACTIVE" ? (
                <>
                  <ActionModal
                    key={`guardar-${goal.id}-${refreshKey}`}
                    triggerLabel="Guardar"
                    triggerClassName="button-link workspace-primary-action"
                    title={`Guardar em ${goal.name}`}
                    icon={<GoalBadge icon={goal.icon} color={goal.color} size={30} />}
                    initiallyOpen={failed(goal.id, "guardar")}
                  >
                    {failed(goal.id, "guardar") ? <p className="error">{searchParams.erro}</p> : null}
                    <GoalMoveForm action={depositToSavingsGoalAction.bind(null, goal.id, "lista")} accounts={accountOptions} direction="DEPOSIT" balanceCents={goal.balanceCents} defaultAccountId={goal.defaultSourceAccountId} today={today} idPrefix={`guardar-${goal.id}`} />
                  </ActionModal>
                  <ActionModal
                    key={`resgatar-${goal.id}-${refreshKey}`}
                    triggerLabel="Resgatar"
                    title={`Resgatar de ${goal.name}`}
                    icon={<GoalBadge icon={goal.icon} color={goal.color} size={30} />}
                    initiallyOpen={failed(goal.id, "resgatar")}
                  >
                    {failed(goal.id, "resgatar") ? <p className="error">{searchParams.erro}</p> : null}
                    {goal.balanceCents > BigInt(0)
                      ? <GoalMoveForm action={withdrawFromSavingsGoalAction.bind(null, goal.id, "lista")} accounts={accountOptions} direction="WITHDRAW" balanceCents={goal.balanceCents} defaultAccountId={goal.defaultSourceAccountId} today={today} idPrefix={`resgatar-${goal.id}`} />
                      : <p className="muted">Este cofrinho ainda está vazio.</p>}
                  </ActionModal>
                  <Link href={`/cofrinhos/${goal.id}`} className="button-link">Detalhes</Link>
                </>
              ) : <Link href={`/cofrinhos/${goal.id}`} className="button-link">Detalhes</Link>}
            />
          ))}
        </div>
      )}
    </main>
  );
}
