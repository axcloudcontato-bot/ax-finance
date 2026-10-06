import type { listTitlesPage } from "@ax-finance/domain";
import { formatCents } from "@/lib/currency";
import { formatDateOnly } from "@/lib/dates";

type Summary = Awaited<ReturnType<typeof listTitlesPage>>["summary"];

/** Resumo do conjunto INTEIRO da seleção (calculado no banco), não só da página que está na tela. */
export function TitleListSummary({ summary, total, kind, scopeNote = "Conforme período e filtro acima", overdueView = false }: { summary: Summary; total: number; kind: "entradas" | "saídas"; scopeNote?: string; overdueView?: boolean }) {
  return (
    <section className="workspace-metrics" aria-label={`Resumo das ${kind} exibidas`}>
      <div className="workspace-metric">
        <span className="workspace-metric-label">{overdueView ? "Saldo vencido" : "Saldo em aberto"}</span>
        <strong>{formatCents(summary.openCents)}</strong>
        <span className="workspace-metric-detail">{summary.openCount} {summary.openCount === 1 ? "lançamento pendente" : "lançamentos pendentes"}</span>
      </div>
      <div className="workspace-metric workspace-metric-alert">
        <span className="workspace-metric-label">{overdueView ? "Vencimento mais antigo" : "Vencido na seleção"}</span>
        <strong>{overdueView ? summary.oldestOverdueDate ? formatDateOnly(summary.oldestOverdueDate) : "—" : formatCents(summary.overdueCents)}</strong>
        <span className="workspace-metric-detail">{summary.overdueCount} {summary.overdueCount === 1 ? "título vencido" : "títulos vencidos"}</span>
      </div>
      <div className="workspace-metric">
        <span className="workspace-metric-label">Na seleção</span>
        <strong>{total}</strong>
        <span className="workspace-metric-detail">{scopeNote}</span>
      </div>
    </section>
  );
}
