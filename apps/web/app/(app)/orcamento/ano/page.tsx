import Link from "next/link";
import { redirect } from "next/navigation";
import { getAnnualBudgetReport } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { formatCents } from "@/lib/currency";
import { todayDateOnlyString } from "@/lib/dates";
import { budgetSections } from "@/lib/budget-groups";
import { ActionModal } from "@/components/ui/action-modal";
import { SubmitButton } from "@/components/ui/submit-button";
import { ScrollToCurrent } from "@/components/scroll-to-current";
import { BudgetYearAutofill } from "@/components/budget/budget-year-autofill";
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

type AnnualRow = Awaited<ReturnType<typeof getAnnualBudgetReport>>["rows"][number];

/** Linha editável da grade: um campo por mês e, embaixo, o realizado. */
function YearRow({ row, label, nested, currentMonth }: { row: AnnualRow; label: string; nested: boolean; currentMonth: string }) {
  const revenue = row.kind === "REVENUE";
  return (
    <tr className={nested ? "budget-child" : undefined}>
      <th scope="row">{nested ? <span className="muted" aria-hidden="true">↳ </span> : null}{label}</th>
      {row.cells.map((cell, index) => {
        const over = !revenue && cell.plannedCents > ZERO && cell.actualCents > cell.plannedCents;
        return (
          <td key={cell.period} className={cell.period === currentMonth ? "is-current" : undefined}>
            <input type="hidden" name={`w|${row.categoryId}|${cell.period}`} value={toInput(cell.plannedCents)} />
            <input name={`a|${row.categoryId}|${cell.period}`} defaultValue={toInput(cell.plannedCents)} inputMode="decimal" placeholder="—" aria-label={`${label}, ${MONTH_SHORT[index]}`} className="budget-year-input" />
            {cell.actualCents > ZERO ? <small className={over ? "is-over" : undefined}>{short(cell.actualCents)}</small> : null}
          </td>
        );
      })}
      <td className="money budget-year-total">
        <strong>{formatCents(row.plannedCents)}</strong>
        <small className={!revenue && row.status === "OVER" ? "is-over" : undefined}>{revenue ? "recebido" : "gasto"} {formatCents(row.actualCents)}{row.plannedCents > ZERO ? ` · ${Math.round(row.percent)}%` : ""}</small>
      </td>
    </tr>
  );
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
  const sections = budgetSections(report.rows);
  const plannedResult = report.revenueTotals.plannedCents - report.totals.plannedCents;
  const usedPercent = report.totals.plannedCents > ZERO ? Math.round(Number((report.totals.actualCents * BigInt(1000)) / report.totals.plannedCents) / 10) : null;
  const currentMonth = today.slice(0, 7);

  return (
    <main className="wide budget-year-page">
      <div className="page-header">
        <div>
          <h1>Orçamento de {year}</h1>
          <p className="subtitle">Planeje os 12 meses de cada categoria, separando o que espera receber do que pretende gastar. Embaixo de cada valor aparece o realizado do mês.</p>
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

      <section className="workspace-metrics budget-metrics" aria-label="Resumo do ano">
        <div className="workspace-metric"><span className="workspace-metric-label">Receitas previstas no ano</span><strong className="positive">{formatCents(report.revenueTotals.plannedCents)}</strong><span className="workspace-metric-detail">Recebido {formatCents(report.revenueTotals.actualCents)}</span></div>
        <div className="workspace-metric"><span className="workspace-metric-label">Despesas planejadas no ano</span><strong className="negative">{formatCents(report.totals.plannedCents)}</strong><span className="workspace-metric-detail">Gasto {formatCents(report.totals.actualCents)}{usedPercent !== null ? ` · ${usedPercent}%` : ""}</span></div>
        <div className="workspace-metric workspace-metric-primary"><span className="workspace-metric-label">Resultado previsto</span><strong className={plannedResult < ZERO ? "negative" : undefined}>{formatCents(plannedResult)}</strong><span className="workspace-metric-detail">Receitas previstas − despesas planejadas</span></div>
        <div className="workspace-metric"><span className="workspace-metric-label">Despesas acima do planejado</span><strong className={report.totals.overCount > 0 ? "negative" : undefined}>{report.totals.overCount}</strong><span className="workspace-metric-detail">Categorias, no acumulado do ano</span></div>
      </section>

      <form action={saveBudgetYearAction}>
        <input type="hidden" name="year" value={year} />
        {report.rows.length === 0 ? (
          <div className="card"><div className="workspace-empty"><strong>Nenhuma categoria para orçar</strong><p>Cadastre categorias de receita e de despesa em Cadastros &gt; Categorias.</p></div></div>
        ) : (
          <>
            {sections.map((section) => {
              const revenue = section.kind === "REVENUE";
              const monthTotals = revenue ? report.revenueMonthTotals : report.monthTotals;
              const sectionTotals = revenue ? report.revenueTotals : report.totals;
              return (
                <section key={section.kind} className={`card budget-section is-${section.kind.toLowerCase()}`} aria-labelledby={`budget-year-${section.kind}`}>
                  <div className="workspace-card-heading">
                    <div>
                      <h2 id={`budget-year-${section.kind}`}>{section.title}</h2>
                      <p>{revenue ? "Quanto espera receber por mês. O número pequeno é o que entrou." : "Quanto pretende gastar por mês. O número pequeno é o gasto; em vermelho, acima do planejado."}</p>
                    </div>
                  </div>
                  {section.groups.length === 0 ? (
                    <div className="workspace-empty"><strong>{revenue ? "Nenhuma categoria de receita" : "Nenhuma categoria de despesa"}</strong><p>Cadastre em Cadastros &gt; Categorias.</p></div>
                  ) : (
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
                          {section.groups.map((group) => {
                            if (group.children.length === 0) return <YearRow key={group.head.categoryId} row={group.head} label={group.head.name} nested={false} currentMonth={currentMonth} />;
                            const members = [group.head, ...group.children];
                            const ownValues = group.head.plannedCents > ZERO || group.head.actualCents > ZERO;
                            return [
                              <tr key={`${group.head.categoryId}-grupo`} className="budget-group">
                                <th scope="row">{group.head.name}</th>
                                {report.months.map((month, index) => {
                                  const planned = members.reduce((sum, row) => sum + row.cells[index]!.plannedCents, ZERO);
                                  const actual = members.reduce((sum, row) => sum + row.cells[index]!.actualCents, ZERO);
                                  return (
                                    <td key={month} className={`money${month === currentMonth ? " is-current" : ""}`}>
                                      <strong>{planned > ZERO ? short(planned) : "—"}</strong>
                                      <small className={!revenue && planned > ZERO && actual > planned ? "is-over" : undefined}>{actual > ZERO ? short(actual) : "—"}</small>
                                    </td>
                                  );
                                })}
                                <td className="money budget-year-total">
                                  <strong>{formatCents(members.reduce((sum, row) => sum + row.plannedCents, ZERO))}</strong>
                                  <small>{revenue ? "recebido" : "gasto"} {formatCents(members.reduce((sum, row) => sum + row.actualCents, ZERO))}</small>
                                </td>
                              </tr>,
                              ...group.children.map((child) => <YearRow key={child.categoryId} row={child} label={child.name} nested currentMonth={currentMonth} />),
                              ownValues ? <YearRow key={`${group.head.categoryId}-proprio`} row={group.head} label={`${group.head.name} (sem subcategoria)`} nested currentMonth={currentMonth} /> : null,
                            ];
                          })}
                        </tbody>
                        <tfoot>
                          <tr>
                            <th scope="row">{revenue ? "Total de receitas" : "Total de despesas"}</th>
                            {monthTotals.map((month) => (
                              <td key={month.period} className={`money${month.period === currentMonth ? " is-current" : ""}`}>
                                <strong>{month.plannedCents > ZERO ? short(month.plannedCents) : "—"}</strong>
                                <small className={!revenue && month.plannedCents > ZERO && month.actualCents > month.plannedCents ? "is-over" : undefined}>{month.actualCents > ZERO ? short(month.actualCents) : "—"}</small>
                              </td>
                            ))}
                            <td className="money budget-year-total"><strong>{formatCents(sectionTotals.plannedCents)}</strong><small>{revenue ? "recebido" : "gasto"} {formatCents(sectionTotals.actualCents)}</small></td>
                          </tr>
                        </tfoot>
                      </table>
                    </ScrollToCurrent>
                  )}
                </section>
              );
            })}
            <BudgetYearAutofill />
            <p className="field-note">Digite em reais (1.200 ou 1.200,50). O primeiro valor de uma categoria se repete nos meses vazios; ajuste à mão os meses diferentes. Deixe em branco para não orçar o mês. A linha da categoria principal soma as subcategorias.</p>
            <div className="budget-save"><SubmitButton>Salvar orçamento do ano</SubmitButton></div>
          </>
        )}
      </form>
    </main>
  );
}
