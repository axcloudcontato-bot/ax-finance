import Link from "next/link";
import { redirect } from "next/navigation";
import { getBudgetReport, type BudgetStatus } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { formatCents } from "@/lib/currency";
import { addMonths, monthLabel, resolvePeriodRange } from "@/lib/month";
import { sortCategoriesTree } from "@/lib/categories";
import { SubmitButton } from "@/components/ui/submit-button";
import { copyBudgetsAction, saveBudgetsAction } from "./actions";

const STATUS_LABEL: Record<BudgetStatus, string> = {
  OK: "Dentro do orçamento",
  WARNING: "Perto do limite",
  OVER: "Estourou",
  UNBUDGETED: "Sem orçamento",
};

/** "1200,00" para o campo de texto, no formato que o leitor de valores aceita de volta. */
function toInput(cents: bigint): string {
  return cents === BigInt(0) ? "" : (Number(cents) / 100).toFixed(2).replace(".", ",");
}

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

  // Subcategoria cuja categoria-pai não é de gasto vira linha de topo, para nunca sumir da lista.
  const ids = new Set(report.rows.map((row) => row.categoryId));
  const rows = sortCategoriesTree(report.rows.map((row) => ({ ...row, id: row.categoryId, order: 0, parentId: row.parentId && ids.has(row.parentId) ? row.parentId : null })));
  const { totals } = report;

  return (
    <main className="wide">
      <div className="page-header">
        <div>
          <h1>Orçamento</h1>
          <p className="subtitle">{monthLabel(month)} · quanto você pretende gastar em cada categoria, comparado com o que já foi lançado. É uma referência: nada é bloqueado.</p>
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

      <section className="workspace-metrics" aria-label="Resumo do orçamento">
        <div className="workspace-metric workspace-metric-primary"><span className="workspace-metric-label">Orçamento do mês</span><strong>{formatCents(totals.plannedCents)}</strong><span className="workspace-metric-detail">Soma das categorias com valor</span></div>
        <div className="workspace-metric"><span className="workspace-metric-label">Já gasto nelas</span><strong>{formatCents(totals.actualOnBudgetedCents)}</strong><span className="workspace-metric-detail">{totals.plannedCents > BigInt(0) ? `${Math.round(Number((totals.actualOnBudgetedCents * BigInt(1000)) / totals.plannedCents) / 10)}% do orçamento` : "Defina valores abaixo"}</span></div>
        <div className="workspace-metric"><span className="workspace-metric-label">Gasto sem orçamento</span><strong>{formatCents(totals.unbudgetedActualCents)}</strong><span className="workspace-metric-detail">Categorias sem valor neste mês</span></div>
      </section>

      <form action={saveBudgetsAction} className="card">
        <input type="hidden" name="period" value={month} />
        {rows.length === 0 ? (
          <div className="workspace-empty"><strong>Nenhuma categoria de gasto</strong><p>Cadastre categorias de despesa para poder orçar.</p></div>
        ) : (
          <>
            <div className="table-scroll">
              <table className="workspace-table budget-table">
                <thead>
                  <tr>
                    <th>Categoria</th>
                    <th className="money">Orçado (R$)</th>
                    <th className="money">Gasto</th>
                    <th className="money">Saldo</th>
                    <th>Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.categoryId}>
                      <td>{row.parentId ? <span className="muted">↳ </span> : null}{row.name}</td>
                      <td className="money">
                        <input type="hidden" name={`was_${row.categoryId}`} value={toInput(row.plannedCents)} />
                        <input name={`amount_${row.categoryId}`} defaultValue={toInput(row.plannedCents)} inputMode="decimal" placeholder="0,00" aria-label={`Orçamento de ${row.name}`} className="budget-input" />
                      </td>
                      <td className="money">{formatCents(row.actualCents)}</td>
                      <td className={`money${row.remainingCents < BigInt(0) ? " budget-negative" : ""}`}>{row.plannedCents > BigInt(0) ? formatCents(row.remainingCents) : "—"}</td>
                      <td>
                        {row.plannedCents > BigInt(0) ? (
                          <div className="budget-meter" data-status={row.status}>
                            <div className="budget-meter-track" role="img" aria-label={`${Math.round(row.percent)}% do orçamento`}><span style={{ width: `${Math.min(100, row.percent)}%` }} /></div>
                            <small>{STATUS_LABEL[row.status]} · {Math.round(row.percent)}%</small>
                          </div>
                        ) : (
                          <small className="muted">{row.status === "UNBUDGETED" ? STATUS_LABEL.UNBUDGETED : "—"}</small>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <SubmitButton>Salvar orçamento</SubmitButton>
          </>
        )}
      </form>
    </main>
  );
}
