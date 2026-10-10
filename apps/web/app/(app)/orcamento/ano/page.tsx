import Link from "next/link";
import { redirect } from "next/navigation";
import { getAnnualBudgetReport } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { formatCents } from "@/lib/currency";
import { todayDateOnlyString } from "@/lib/dates";
import { sortCategoriesTree } from "@/lib/categories";
import { ActionModal } from "@/components/ui/action-modal";
import { SubmitButton } from "@/components/ui/submit-button";
import { ScrollToCurrent } from "@/components/scroll-to-current";
import { fillBudgetYearAction, saveBudgetYearAction } from "../actions";

const MONTH_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const ZERO = BigInt(0);

/** "1200" para o campo (orçamento em reais inteiros fica mais limpo na grade); centavos quando houver. */
function toInput(cents: bigint): string {
  if (cents === ZERO) return "";
  const value = Number(cents) / 100;
  return Number.isInteger(value) ? value.toLocaleString("pt-BR") : value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Valor curto para o realizado embaixo de cada célula. */
function short(cents: bigint): string {
  const value = Number(cents) / 100;
  return value >= 10_000 ? `${Math.round(value / 1000).toLocaleString("pt-BR")} mil` : value.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

export default async function AnnualBudgetPage(props: { searchParams: Promise<{ ano?: string; erro?: string; salvo?: string; planejado?: string }> }) {
  const searchParams = await props.searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await requirePrimaryCompany(user.id);

  const today = todayDateOnlyString();
  const currentYear = Number(today.slice(0, 4));
  const year = /^\d{4}$/.test(searchParams.ano ?? "") ? Number(searchParams.ano) : currentYear;
  const report = await getAnnualBudgetReport(user.id, company.id, year);
  const ids = new Set(report.rows.map((row) => row.categoryId));
  const rows = sortCategoriesTree(report.rows.map((row) => ({ ...row, id: row.categoryId, order: 0, parentId: row.parentId && ids.has(row.parentId) ? row.parentId : null })));
  const usedPercent = report.totals.plannedCents > ZERO ? Math.round(Number((report.totals.actualCents * BigInt(1000)) / report.totals.plannedCents) / 10) : null;
  const currentMonth = today.slice(0, 7);

  return (
    <main className="wide budget-year-page">
      <div className="page-header">
        <div>
          <h1>Orçamento de {year}</h1>
          <p className="subtitle">Planeje os 12 meses de cada categoria e compare com o que foi gasto. Embaixo de cada valor aparece o realizado do mês.</p>
        </div>
        <div className="budget-year-actions">
          <ActionModal triggerLabel="Planejar o ano" triggerClassName="button-link workspace-primary-action" title={`Planejar ${year}`} size="wide" initiallyOpen={Boolean(searchParams.erro) && !searchParams.salvo}>
            {searchParams.erro ? <p className="error">{searchParams.erro}</p> : null}
            <form action={fillBudgetYearAction}>
              <input type="hidden" name="year" value={year} />
              <fieldset className="budget-plan-modes">
                <legend>Partir de</legend>
                <label><input type="radio" name="mode" value="COPY_MONTH" defaultChecked /> <span><strong>Um mês</strong><small>Repete o orçamento do mês escolhido em todos os meses do ano.</small></span></label>
                <label><input type="radio" name="mode" value="PREVIOUS_YEAR" /> <span><strong>O orçamento de {year - 1}</strong><small>Cada mês repete o que foi orçado no mesmo mês do ano anterior.</small></span></label>
                <label><input type="radio" name="mode" value="PREVIOUS_YEAR_ACTUAL" /> <span><strong>O gasto real de {year - 1}</strong><small>Cada mês parte do que foi gasto de verdade no mesmo mês do ano anterior.</small></span></label>
              </fieldset>
              <div className="form-grid">
                <div>
                  <label htmlFor="plan-source">Mês de origem (opção &ldquo;Um mês&rdquo;)</label>
                  <select id="plan-source" name="sourcePeriod" defaultValue={currentMonth.startsWith(String(year)) ? currentMonth : `${year}-01`}>
                    {report.months.map((month, index) => <option key={month} value={month}>{MONTH_SHORT[index]}/{year}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="plan-adjust">Reajuste (%)</label>
                  <input id="plan-adjust" name="adjustment" type="text" inputMode="numeric" placeholder="0" />
                  <p className="field-note">Ex.: 5 para +5% (inflação), −10 para cortar 10%. Valores arredondados para reais.</p>
                </div>
              </div>
              <label className="record-detail-checkbox"><input type="checkbox" name="overwrite" value="true" /> Substituir valores que já estão preenchidos</label>
              <div className="form-actions"><SubmitButton>Preencher o ano</SubmitButton></div>
            </form>
          </ActionModal>
        </div>
      </div>

      <div className="budget-toolbar">
        <nav className="filters" aria-label="Visão do orçamento">
          <Link href="/orcamento">Mês</Link>
          <Link href="/orcamento/ano" className="active" aria-current="page">Ano</Link>
        </nav>
        <nav className="calendar-nav" aria-label="Mudar de ano">
          <Link href={`/orcamento/ano?ano=${year - 1}`} className="button-link" aria-label="Ano anterior">‹</Link>
          <strong>{year}</strong>
          <Link href={`/orcamento/ano?ano=${year + 1}`} className="button-link" aria-label="Próximo ano">›</Link>
        </nav>
      </div>

      {searchParams.salvo ? <p className="success-box">{Number(searchParams.salvo) > 0 ? `Orçamento salvo (${searchParams.salvo} ${Number(searchParams.salvo) === 1 ? "valor alterado" : "valores alterados"}).` : "Nada mudou."}</p> : null}
      {searchParams.planejado ? <p className="success-box">{Number(searchParams.planejado) > 0 ? `${searchParams.planejado} ${Number(searchParams.planejado) === 1 ? "valor preenchido" : "valores preenchidos"}. Confira e ajuste o que precisar.` : "Nada a preencher: a origem está vazia ou os meses já tinham valor (marque substituir para trocar)."}</p> : null}

      <section className="workspace-metrics" aria-label="Resumo do ano">
        <div className="workspace-metric workspace-metric-primary"><span className="workspace-metric-label">Planejado no ano</span><strong>{formatCents(report.totals.plannedCents)}</strong><span className="workspace-metric-detail">Soma de todos os meses e categorias</span></div>
        <div className="workspace-metric"><span className="workspace-metric-label">Gasto no ano</span><strong>{formatCents(report.totals.actualCents)}</strong><span className="workspace-metric-detail">{usedPercent !== null ? `${usedPercent}% do planejado` : "Defina valores na grade"}</span></div>
        <div className="workspace-metric"><span className="workspace-metric-label">Categorias acima do planejado</span><strong className={report.totals.overCount > 0 ? "negative" : undefined}>{report.totals.overCount}</strong><span className="workspace-metric-detail">No acumulado do ano</span></div>
      </section>

      <form action={saveBudgetYearAction} className="card">
        <input type="hidden" name="year" value={year} />
        {rows.length === 0 ? (
          <div className="workspace-empty"><strong>Nenhuma categoria de gasto</strong><p>Cadastre categorias de despesa para poder orçar.</p></div>
        ) : (
          <>
            <ScrollToCurrent className="table-scroll budget-year-scroll">
              <table className="workspace-table budget-year-table">
                <thead>
                  <tr>
                    <th>Categoria</th>
                    {report.months.map((month, index) => <th key={month} className={`money${month === currentMonth ? " is-current" : ""}`}>{MONTH_SHORT[index]}</th>)}
                    <th className="money">Ano</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.categoryId}>
                      <th scope="row">{row.parentId ? <span className="muted">↳ </span> : null}{row.name}</th>
                      {row.cells.map((cell, index) => {
                        const over = cell.plannedCents > ZERO && cell.actualCents > cell.plannedCents;
                        return (
                          <td key={cell.period} className={cell.period === currentMonth ? "is-current" : undefined}>
                            <input type="hidden" name={`w|${row.categoryId}|${cell.period}`} value={toInput(cell.plannedCents)} />
                            <input name={`a|${row.categoryId}|${cell.period}`} defaultValue={toInput(cell.plannedCents)} inputMode="decimal" placeholder="—" aria-label={`${row.name}, ${MONTH_SHORT[index]}`} className="budget-year-input" />
                            {cell.actualCents > ZERO ? <small className={over ? "is-over" : undefined}>{short(cell.actualCents)}</small> : null}
                          </td>
                        );
                      })}
                      <td className="money budget-year-total">
                        <strong>{formatCents(row.plannedCents)}</strong>
                        <small className={row.status === "OVER" ? "is-over" : undefined}>gasto {formatCents(row.actualCents)}{row.plannedCents > ZERO ? ` · ${Math.round(row.percent)}%` : ""}</small>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row">Total</th>
                    {report.monthTotals.map((month) => (
                      <td key={month.period} className={`money${month.period === currentMonth ? " is-current" : ""}`}>
                        <strong>{month.plannedCents > ZERO ? short(month.plannedCents) : "—"}</strong>
                        <small className={month.plannedCents > ZERO && month.actualCents > month.plannedCents ? "is-over" : undefined}>{month.actualCents > ZERO ? short(month.actualCents) : "—"}</small>
                      </td>
                    ))}
                    <td className="money budget-year-total"><strong>{formatCents(report.totals.plannedCents)}</strong><small>gasto {formatCents(report.totals.actualCents)}</small></td>
                  </tr>
                </tfoot>
              </table>
            </ScrollToCurrent>
            <p className="field-note">Digite em reais (1.200 ou 1.200,50). Deixe em branco para não orçar o mês. O número pequeno é o gasto do mês; em vermelho, acima do planejado.</p>
            <SubmitButton>Salvar orçamento do ano</SubmitButton>
          </>
        )}
      </form>
    </main>
  );
}
