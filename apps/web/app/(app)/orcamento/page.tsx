import Link from "next/link";
import { CategoryIcon } from "@/components/categories/category-icon";
import { redirect } from "next/navigation";
import { budgetStatus, getBudgetReport, revenueBudgetStatus, type BudgetRow, type BudgetStatus } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { formatCents } from "@/lib/currency";
import { addMonths, monthLabel, resolvePeriodRange } from "@/lib/month";
import { budgetSections } from "@/lib/budget-groups";
import { SubmitButton } from "@/components/ui/submit-button";
import { copyBudgetsAction, saveBudgetsAction } from "./actions";

const ZERO = BigInt(0);

const STATUS_LABEL: Record<BudgetStatus, string> = {
  OK: "Dentro do orçamento",
  WARNING: "Perto do limite",
  OVER: "Estourou",
  UNBUDGETED: "Sem orçamento",
  BELOW: "Abaixo da meta",
  REACHED: "Meta atingida",
};

/** "1200,00" para o campo de texto, no formato que o leitor de valores aceita de volta. */
function toInput(cents: bigint): string {
  return cents === ZERO ? "" : (Number(cents) / 100).toFixed(2).replace(".", ",");
}

type Figures = Pick<BudgetRow, "kind" | "plannedCents" | "actualCents">;

function percentOf(planned: bigint, actual: bigint) {
  return planned > ZERO ? Number((actual * BigInt(1000)) / planned) / 10 : 0;
}

function statusOf({ kind, plannedCents, actualCents }: Figures): BudgetStatus {
  return kind === "REVENUE" ? revenueBudgetStatus(plannedCents, actualCents) : budgetStatus(plannedCents, actualCents);
}

/** Saldo e situação de uma linha (categoria, subtotal do grupo ou total da seção). */
function Figures({ figures }: { figures: Figures }) {
  const { kind, plannedCents, actualCents } = figures;
  const status = statusOf(figures);
  const percent = percentOf(plannedCents, actualCents);
  // Despesa: quanto ainda cabe (negativo estourou). Receita: quanto falta entrar (zero quando atingiu).
  const remaining = kind === "REVENUE" ? (plannedCents > actualCents ? plannedCents - actualCents : ZERO) : plannedCents - actualCents;
  return (
    <>
      <td className="money">{formatCents(actualCents)}</td>
      <td className={`money${kind === "EXPENSE" && remaining < ZERO ? " budget-negative" : ""}`}>{plannedCents > ZERO ? formatCents(remaining) : "—"}</td>
      <td>
        {plannedCents > ZERO ? (
          <div className="budget-meter" data-status={status}>
            <div className="budget-meter-track" role="img" aria-label={`${Math.round(percent)}% do ${kind === "REVENUE" ? "previsto" : "orçamento"}`}><span style={{ width: `${Math.min(100, percent)}%` }} /></div>
            <small>{STATUS_LABEL[status]} · {Math.round(percent)}%</small>
          </div>
        ) : (
          <small className="muted">{status === "UNBUDGETED" ? (kind === "REVENUE" ? "Sem previsão" : STATUS_LABEL.UNBUDGETED) : "—"}</small>
        )}
      </td>
    </>
  );
}

function EditableRow({ row, label, nested }: { row: BudgetRow; label: string; nested: boolean }) {
  return (
    <tr className={nested ? "budget-child" : undefined}>
      <td><span className="category-name">{nested ? <span className="muted" aria-hidden="true">↳</span> : null}<CategoryIcon name={row.name} nature={row.kind === "REVENUE" ? "OPERATING_REVENUE" : "EXPENSE"} />{label}</span></td>
      <td className="money">
        <input type="hidden" name={`was_${row.categoryId}`} value={toInput(row.plannedCents)} />
        <input name={`amount_${row.categoryId}`} defaultValue={toInput(row.plannedCents)} inputMode="decimal" placeholder="0,00" aria-label={`${row.kind === "REVENUE" ? "Previsão" : "Orçamento"} de ${label}`} className="budget-input" />
      </td>
      <Figures figures={row} />
    </tr>
  );
}

const sum = (rows: Figures[], kind: Figures["kind"]): Figures => ({
  kind,
  plannedCents: rows.reduce((total, row) => total + row.plannedCents, ZERO),
  actualCents: rows.reduce((total, row) => total + row.actualCents, ZERO),
});

export default async function OrcamentoPage(props: {
  searchParams: Promise<{ mes?: string; de?: string; ate?: string; periodo?: string; comparar?: string; erro?: string; salvo?: string; copiado?: string }>;
}) {
  const searchParams = await props.searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await requirePrimaryCompany(user.id);

  const month = resolvePeriodRange(searchParams).from.slice(0, 7);
  const previousMonth = addMonths(month, -1);
  const report = await getBudgetReport(user.id, company.id, month);
  const sections = budgetSections(report.rows);
  const { totals, revenueTotals } = report;
  const plannedResult = revenueTotals.plannedCents - totals.plannedCents;

  return (
    <main className="wide">
      <div className="page-header">
        <div>
          <h1>Orçamento</h1>
          <p className="subtitle">{monthLabel(month)} · quanto você espera receber e pretende gastar em cada categoria, comparado com o que já foi lançado. É uma referência: nada é bloqueado.</p>
        </div>
        <div className="budget-year-actions">
        <form action={copyBudgetsAction}>
          <input type="hidden" name="period" value={month} />
          <input type="hidden" name="from" value={previousMonth} />
          <SubmitButton className="secondary">Copiar de {monthLabel(previousMonth)}</SubmitButton>
        </form>
        </div>
      </div>

      <div className="budget-toolbar">
        <nav className="filters" aria-label="Visão do orçamento">
          <Link href="/orcamento" className="active" aria-current="page">Mês</Link>
          <Link href={`/orcamento/ano?ano=${month.slice(0, 4)}`}>Ano</Link>
        </nav>
      </div>

      {searchParams.erro ? <p className="error">{searchParams.erro}</p> : null}
      {searchParams.salvo ? <p className="success-box">{Number(searchParams.salvo) > 0 ? `Orçamento salvo (${searchParams.salvo} ${Number(searchParams.salvo) === 1 ? "categoria alterada" : "categorias alteradas"}).` : "Nada mudou."}</p> : null}
      {searchParams.copiado ? <p className="success-box">{Number(searchParams.copiado) > 0 ? `${searchParams.copiado} ${Number(searchParams.copiado) === 1 ? "categoria copiada" : "categorias copiadas"} de ${monthLabel(previousMonth)}.` : `Nada a copiar: ${monthLabel(previousMonth)} não tem orçamento, ou este mês já está preenchido.`}</p> : null}
      {totals.overCount > 0 ? <p className="error">{totals.overCount} {totals.overCount === 1 ? "categoria estourou" : "categorias estouraram"} o orçamento neste mês.</p> : null}

      <section className="workspace-metrics budget-metrics" aria-label="Resumo do orçamento">
        <div className="workspace-metric"><span className="workspace-metric-label">Receitas previstas</span><strong className="positive">{formatCents(revenueTotals.plannedCents)}</strong><span className="workspace-metric-detail">Recebido {formatCents(revenueTotals.actualCents)}</span></div>
        <div className="workspace-metric"><span className="workspace-metric-label">Despesas orçadas</span><strong className="negative">{formatCents(totals.plannedCents)}</strong><span className="workspace-metric-detail">{totals.plannedCents > ZERO ? `Gasto ${formatCents(totals.actualOnBudgetedCents)} · ${Math.round(percentOf(totals.plannedCents, totals.actualOnBudgetedCents))}%` : "Defina valores abaixo"}</span></div>
        <div className="workspace-metric workspace-metric-primary"><span className="workspace-metric-label">Resultado previsto</span><strong className={plannedResult < ZERO ? "negative" : undefined}>{formatCents(plannedResult)}</strong><span className="workspace-metric-detail">Receitas previstas − despesas orçadas</span></div>
        <div className="workspace-metric"><span className="workspace-metric-label">Gasto sem orçamento</span><strong>{formatCents(totals.unbudgetedActualCents)}</strong><span className="workspace-metric-detail">Categorias sem valor neste mês</span></div>
      </section>

      <form action={saveBudgetsAction}>
        <input type="hidden" name="period" value={month} />
        {sections.map((section) => {
          const revenue = section.kind === "REVENUE";
          const sectionRows = section.groups.flatMap((group) => [group.head, ...group.children]);
          return (
            <section key={section.kind} className={`card budget-section is-${section.kind.toLowerCase()}`} aria-labelledby={`budget-${section.kind}`}>
              <div className="workspace-card-heading">
                <div>
                  <h2 id={`budget-${section.kind}`}>{section.title}</h2>
                  <p>{revenue ? "Quanto você espera receber em cada categoria de entrada." : "Quanto você pretende gastar em cada categoria de saída."}</p>
                </div>
              </div>
              {section.groups.length === 0 ? (
                <div className="workspace-empty"><strong>{revenue ? "Nenhuma categoria de receita" : "Nenhuma categoria de despesa"}</strong><p>Cadastre categorias em Cadastros &gt; Categorias para poder orçar.</p></div>
              ) : (
                <div className="table-scroll">
                  <table className="workspace-table budget-table">
                    <thead>
                      <tr>
                        <th>Categoria</th>
                        <th className="money">{revenue ? "Previsto (R$)" : "Orçado (R$)"}</th>
                        <th className="money">{revenue ? "Recebido" : "Gasto"}</th>
                        <th className="money">{revenue ? "Falta receber" : "Saldo"}</th>
                        <th>Situação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {section.groups.map((group) => {
                        if (group.children.length === 0) return <EditableRow key={group.head.categoryId} row={group.head} label={group.head.name} nested={false} />;
                        const ownValues = group.head.plannedCents > ZERO || group.head.actualCents > ZERO;
                        const subtotal = sum([group.head, ...group.children], section.kind);
                        return [
                          <tr key={`${group.head.categoryId}-grupo`} className="budget-group">
                            <th scope="row"><span className="category-name"><CategoryIcon name={group.head.name} nature={group.head.kind === "REVENUE" ? "OPERATING_REVENUE" : "EXPENSE"} />{group.head.name}</span></th>
                            <td className="money"><strong>{subtotal.plannedCents > ZERO ? formatCents(subtotal.plannedCents) : "—"}</strong></td>
                            <Figures figures={subtotal} />
                          </tr>,
                          ...group.children.map((child) => <EditableRow key={child.categoryId} row={child} label={child.name} nested />),
                          ownValues ? <EditableRow key={`${group.head.categoryId}-proprio`} row={group.head} label={`${group.head.name} (sem subcategoria)`} nested /> : null,
                        ];
                      })}
                    </tbody>
                    <tfoot>
                      <tr>
                        <th scope="row">{revenue ? "Total de receitas" : "Total de despesas"}</th>
                        <td className="money"><strong>{formatCents(sum(sectionRows, section.kind).plannedCents)}</strong></td>
                        <Figures figures={sum(sectionRows, section.kind)} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </section>
          );
        })}
        {report.rows.length > 0 ? <div className="budget-save"><SubmitButton>Salvar orçamento</SubmitButton></div> : null}
      </form>
    </main>
  );
}
