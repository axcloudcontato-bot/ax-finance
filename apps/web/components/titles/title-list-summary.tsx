import type { listTitles } from "@ax-finance/domain";
import { formatCents } from "@/lib/currency";
import { formatDateOnly, toDateOnlyString, todayDateOnlyString } from "@/lib/dates";

type Title = Awaited<ReturnType<typeof listTitles>>[number];

export function TitleListSummary({ titles, kind, scopeNote = "Conforme período e filtro acima", overdueView = false }: { titles: Title[]; kind: "entradas" | "saídas"; scopeNote?: string; overdueView?: boolean }) {
  const today = todayDateOnlyString();
  const open = titles.filter((title) => title.status !== "SETTLED" && title.status !== "CANCELLED");
  const overdue = open.filter((title) => toDateOnlyString(title.dueDate) < today);
  const openCents = open.reduce((sum, title) => sum + title.remainingCents, BigInt(0));
  const overdueCents = overdue.reduce((sum, title) => sum + title.remainingCents, BigInt(0));
  const oldestOverdue = overdue.length > 0
    ? overdue.reduce((oldest, title) => toDateOnlyString(title.dueDate) < toDateOnlyString(oldest.dueDate) ? title : oldest).dueDate
    : null;

  return (
    <section className="workspace-metrics" aria-label={`Resumo das ${kind} exibidas`}>
      <div className="workspace-metric">
        <span className="workspace-metric-label">{overdueView ? "Saldo vencido" : "Saldo em aberto"}</span>
        <strong>{formatCents(openCents)}</strong>
        <span className="workspace-metric-detail">{open.length} {open.length === 1 ? "lançamento pendente" : "lançamentos pendentes"}</span>
      </div>
      <div className="workspace-metric workspace-metric-alert">
        <span className="workspace-metric-label">{overdueView ? "Vencimento mais antigo" : "Vencido na seleção"}</span>
        <strong>{overdueView ? oldestOverdue ? formatDateOnly(oldestOverdue) : "—" : formatCents(overdueCents)}</strong>
        <span className="workspace-metric-detail">{overdue.length} {overdue.length === 1 ? "título vencido" : "títulos vencidos"}</span>
      </div>
      <div className="workspace-metric">
        <span className="workspace-metric-label">Na seleção</span>
        <strong>{titles.length}</strong>
        <span className="workspace-metric-detail">{scopeNote}</span>
      </div>
    </section>
  );
}
