import Link from "next/link";
import type { getBudgetReport, getDashboardInsights, getDashboardOverview, listCreditCards } from "@ax-finance/domain";
import { formatCents } from "@/lib/currency";
import { formatDateOnly } from "@/lib/dates";
import { LimitBar } from "@/components/credit-cards/limit-bar";
import { IssuerBadge } from "@/components/credit-cards/issuer-badge";

export type Insights = Awaited<ReturnType<typeof getDashboardInsights>>;
export type Overview = Awaited<ReturnType<typeof getDashboardOverview>>;
export type BudgetSummary = Awaited<ReturnType<typeof getBudgetReport>>;
export type CardSummary = Awaited<ReturnType<typeof listCreditCards>>[number];

const ZERO = BigInt(0);

export const percentOf = (bps: number) => `${(bps / 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
const signed = (cents: bigint) => (cents > ZERO ? "+" : "");

/** Variação contra o período de comparação, em texto curto. */
function delta(current: bigint, previous: bigint): string {
  if (previous === ZERO) return current === ZERO ? "Sem variação" : "Sem base comparável";
  const difference = current - previous;
  const percent = Number((difference * BigInt(10_000)) / (previous < ZERO ? -previous : previous)) / 100;
  return `${formatCents(previous)} antes · ${signed(difference)}${percent.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

function Metric({ label, value, detail, tone, compare }: { label: string; value: string; detail: string; tone?: "positive" | "negative"; compare?: string }) {
  return (
    <div className={`insight-metric ${tone ? `is-${tone}` : ""}`}>
      <span className="insight-metric-label">{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
      {compare ? <small className="insight-metric-compare">{compare}</small> : null}
    </div>
  );
}

/** Resultado por competência: o que a operação gerou no período, pago ou não. Não é o caixa. */
export function ResultPanel({ insights, personal, compareLabel }: { insights: Insights; personal: boolean; compareLabel?: string }) {
  const { period, comparison } = insights;
  const tone = period.resultCents > ZERO ? "positive" : period.resultCents < ZERO ? "negative" : undefined;
  const compare = (current: bigint, previous: bigint | undefined) => (comparison && previous !== undefined ? `${compareLabel ?? "vs. anterior"}: ${delta(current, previous)}` : undefined);
  return (
    <section className="card dashboard-insight-section" aria-label="Resultado do período">
      <div className="dashboard-section-heading">
        <div>
          <h2>{personal ? "Quanto sobrou no período" : "Resultado do período"}</h2>
          <p>Pelo mês de competência dos lançamentos, pagos ou não. É o que a {personal ? "sua vida financeira" : "operação"} gerou, diferente do saldo em caixa.</p>
        </div>
      </div>
      <div className="insight-metrics">
        <Metric label={personal ? "Entrou" : "Receitas"} value={formatCents(period.revenueCents)} detail="Lançamentos de receita no período" tone="positive" compare={compare(period.revenueCents, comparison?.revenueCents)} />
        <Metric label={personal ? "Saiu" : "Despesas e custos"} value={formatCents(period.expenseCents)} detail="Inclui compras no cartão pela categoria" tone="negative" compare={compare(period.expenseCents, comparison?.expenseCents)} />
        <Metric label={personal ? "Sobrou" : "Resultado"} value={formatCents(period.resultCents)} detail={period.resultCents < ZERO ? "Gastou mais do que entrou" : "Receitas menos despesas"} tone={tone} compare={compare(period.resultCents, comparison?.resultCents)} />
        <Metric
          label={personal ? "Taxa de poupança" : "Margem"}
          value={period.marginBps === null ? "—" : percentOf(period.marginBps)}
          detail={period.marginBps === null ? "Sem receita no período" : personal ? "Parte da receita que sobrou" : "Resultado ÷ receitas"}
          tone={period.marginBps === null ? undefined : period.marginBps >= 0 ? "positive" : "negative"}
        />
      </div>
    </section>
  );
}

/** Para onde foi o dinheiro e de onde veio, por competência e pela categoria real (o cartão aberto nas compras). */
export function CategoryBreakdown({ insights }: { insights: Insights }) {
  const column = (title: string, rows: Insights["expenseByCategory"], tone: "negative" | "positive", empty: string) => (
    <div>
      <h3>{title}</h3>
      {rows.length === 0 ? <p className="muted">{empty}</p> : (
        <div className="category-ranking">
          {rows.map((row) => (
            <div key={row.categoryId} className="category-ranking-row">
              <div><span>{row.name}</span><strong className={tone}>{formatCents(row.cents)} <small>· {percentOf(row.shareBps)}</small></strong></div>
              <span className="category-ranking-track"><span style={{ width: `${Math.max(row.shareBps / 100, 2)}%` }} /></span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
  return (
    <section className="card dashboard-category-section">
      <h2>Receitas e despesas por categoria</h2>
      <p className="subtitle">Por competência, no período. As compras no cartão entram pela categoria de cada uma, não como fatura.</p>
      <div className="dashboard-category-columns">
        {column("Para onde o dinheiro foi", insights.expenseByCategory, "negative", "Nenhuma despesa no período.")}
        {column("De onde o dinheiro veio", insights.revenueByCategory, "positive", "Nenhuma receita no período.")}
      </div>
    </section>
  );
}

const DAY_MS = 86_400_000;
const dayLabel = (date: string, today: string) => {
  if (date < today) return "Atrasados";
  const diff = Math.round((new Date(`${date}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) / DAY_MS);
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Amanhã";
  const weekday = new Date(`${date}T12:00:00Z`).toLocaleDateString("pt-BR", { weekday: "short", timeZone: "UTC" });
  return `${weekday.replace(".", "")}, ${formatDateOnly(date)}`;
};

/** O que vence nos próximos 7 dias (e o que já está atrasado): a lista de quem opera o caixa. */
export function AgendaPanel({ overview }: { overview: Overview }) {
  const today = overview.today;
  const limit = new Date(new Date(`${today}T00:00:00Z`).getTime() + 7 * DAY_MS).toISOString().slice(0, 10);
  const items = overview.projectionTitles
    .filter((title) => title.dueDate.toISOString().slice(0, 10) <= limit)
    .sort((left, right) => left.dueDate.getTime() - right.dueDate.getTime() || left.description.localeCompare(right.description));

  const toReceive = items.filter((item) => item.type === "RECEIVABLE").reduce((sum, item) => sum + item.remainingCents, ZERO);
  const toPay = items.filter((item) => item.type === "PAYABLE").reduce((sum, item) => sum + item.remainingCents, ZERO);

  const groups = new Map<string, typeof items>();
  for (const item of items.slice(0, 14)) {
    const key = dayLabel(item.dueDate.toISOString().slice(0, 10), today);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }

  return (
    <section className="card dashboard-insight-section">
      <div className="dashboard-section-heading">
        <div><h2>Agenda · próximos 7 dias</h2><p>Atrasados e a vencer, para dar baixa sem procurar.</p></div>
        <span>{items.length} {items.length === 1 ? "título" : "títulos"}</span>
      </div>
      {items.length === 0 ? <p className="muted">Nada vence nos próximos 7 dias.</p> : (
        <>
          <p className="agenda-totals"><span className="positive">A receber {formatCents(toReceive)}</span><span className="negative">A pagar {formatCents(toPay)}</span></p>
          <div className="agenda">
            {[...groups.entries()].map(([label, rows]) => (
              <div key={label} className="agenda-day">
                <h3 className={label === "Atrasados" ? "is-late" : undefined}>{label}</h3>
                <ul>
                  {rows.map((row) => (
                    <li key={row.id}>
                      <Link href={row.type === "RECEIVABLE" ? `/entradas/${row.id}` : `/saidas/${row.id}`}>{row.description}</Link>
                      <span className={row.type === "RECEIVABLE" ? "positive" : "negative"}>{row.type === "RECEIVABLE" ? "+ " : "− "}{formatCents(row.remainingCents)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          {items.length > 14 ? <p className="muted agenda-more">E mais {items.length - 14} no período. <Link href="/saidas?filtro=proximas">Ver saídas</Link> · <Link href="/entradas?filtro=proximas">Ver entradas</Link></p> : null}
        </>
      )}
    </section>
  );
}

/** Cartões: limite usado e a fatura que pede atenção. Quem tem acesso restrito não vê (cards = null). */
export function CardsPanel({ cards, today }: { cards: CardSummary[] | null; today: string }) {
  if (cards === null) return null;
  return (
    <section className="card dashboard-insight-section">
      <div className="dashboard-section-heading">
        <div><h2>Cartões de crédito</h2><p>Limite comprometido e a próxima fatura de cada cartão.</p></div>
        <Link href="/cartoes" className="insight-link">Ver cartões</Link>
      </div>
      {cards.length === 0 ? (
        <p className="muted">Nenhum cartão cadastrado. <Link href="/cartoes">Cadastrar um cartão</Link> para acompanhar faturas e limite aqui.</p>
      ) : (
        <ul className="dashboard-cards">
          {cards.slice(0, 4).map((card) => {
            const next = card.nextPayable;
            const soon = next && next.dueDate <= new Date(new Date(`${today}T00:00:00Z`).getTime() + 3 * DAY_MS).toISOString().slice(0, 10);
            return (
              <li key={card.id}>
                <Link href={`/cartoes/${card.id}`} className="dashboard-card-head">
                  <IssuerBadge issuer={card.issuer} size={32} />
                  <span><strong>{card.name}</strong><small>{card.lastDigits ? `final ${card.lastDigits}` : `fecha dia ${card.closingDay}`}</small></span>
                </Link>
                <LimitBar limitCents={card.limitCents} usedCents={card.usedLimitCents} />
                <p className="dashboard-card-invoice">
                  <span>Fatura aberta <strong>{formatCents(card.openCycle.totalCents)}</strong></span>
                  {next ? (
                    <span className={next.stage === "OVERDUE" ? "negative" : soon ? "is-soon" : undefined}>
                      {next.stage === "OVERDUE" ? "Vencida" : "A pagar"} {formatCents(next.remainingCents)} · {next.stage === "OVERDUE" ? "venceu" : "vence"} {formatDateOnly(next.dueDate)}
                    </span>
                  ) : null}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** Orçado × realizado do mês: o que já passou de 80% do limite, e quanto ainda cabe. */
export function BudgetPanel({ budget, personal }: { budget: BudgetSummary; personal: boolean }) {
  const planned = budget.totals.plannedCents;
  const spent = budget.totals.actualOnBudgetedCents;
  const attention = budget.rows
    .filter((row) => row.status === "OVER" || row.status === "WARNING")
    .sort((left, right) => right.percent - left.percent)
    .slice(0, 5);
  const ratio = planned > ZERO ? Number((spent * BigInt(1000)) / planned) / 10 : 0;
  const remaining = planned - spent;
  return (
    <section className="card dashboard-insight-section">
      <div className="dashboard-section-heading">
        <div><h2>Orçamento do mês</h2><p>Quanto você planejou gastar nas categorias, comparado ao que já foi lançado.</p></div>
        <Link href={`/orcamento?mes=${budget.period}`} className="insight-link">Abrir orçamento</Link>
      </div>
      {planned === ZERO ? (
        <p className="muted">Nenhum orçamento definido para este mês. <Link href={`/orcamento?mes=${budget.period}`}>Definir limites por categoria</Link> para ser avisado antes de estourar.</p>
      ) : (
        <>
          <div className="budget-summary">
            <div className="limit-bar-track" role="img" aria-label={`${Math.round(ratio)}% do orçamento usado`}>
              <span className={ratio > 100 ? "is-over" : ratio >= 80 ? "is-high" : ""} style={{ width: `${Math.min(100, ratio)}%` }} />
            </div>
            <p>
              <span>Gasto {formatCents(spent)} de {formatCents(planned)} ({Math.round(ratio)}%)</span>
              <strong className={remaining < ZERO ? "negative" : undefined}>{remaining < ZERO ? `Estourou ${formatCents(-remaining)}` : `${personal ? "Ainda pode gastar" : "Resta"} ${formatCents(remaining)}`}</strong>
            </p>
          </div>
          {attention.length === 0 ? <p className="muted">Todas as categorias orçadas estão abaixo de 80% do limite.</p> : (
            <ul className="budget-attention">
              {attention.map((row) => (
                <li key={row.categoryId}>
                  <span>{row.name}</span>
                  <span className={row.status === "OVER" ? "negative" : "is-soon"}>{Math.round(row.percent)}% · {formatCents(row.actualCents)} de {formatCents(row.plannedCents)}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

type Tone = "good" | "warn" | "bad" | undefined;

function Indicator({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: Tone }) {
  return (
    <li className={tone ? `is-${tone}` : undefined}>
      <div><span>{label}</span><small>{hint}</small></div>
      <strong>{value}</strong>
    </li>
  );
}

/** Dias de caixa: quanto tempo o saldo disponível cobre, no ritmo de saída dos últimos 90 dias. */
export function cashRunwayDays(availableCents: bigint, outflow90Cents: bigint): number | null {
  if (outflow90Cents <= ZERO) return null;
  if (availableCents <= ZERO) return 0;
  return Math.floor((Number(availableCents) * 90) / Number(outflow90Cents));
}

/** Indicadores de saúde. Os de carteira de clientes só fazem sentido no plano empresarial. */
export function HealthPanel({ insights, availableCents, personal }: { insights: Insights; availableCents: bigint; personal: boolean }) {
  const { health } = insights;
  const runway = cashRunwayDays(availableCents, health.outflow90Cents);
  const days = (value: number | null) => (value === null ? "—" : `${value} ${value === 1 ? "dia" : "dias"}`);
  return (
    <section className="card dashboard-insight-section">
      <div className="dashboard-section-heading"><div><h2>Saúde financeira</h2><p>Indicadores para perceber um aperto de caixa antes de ele chegar.</p></div></div>
      <ul className="health-list">
        <Indicator
          label="Dias de caixa"
          value={runway === null ? "—" : `${runway} ${runway === 1 ? "dia" : "dias"}`}
          hint={runway === null ? "Sem saídas nos últimos 90 dias" : "Saldo disponível ÷ média diária de saídas (90 dias)"}
          tone={runway === null ? undefined : runway < 30 ? "bad" : runway < 60 ? "warn" : "good"}
        />
        {personal ? null : (
          <>
            <Indicator
              label="Inadimplência"
              value={health.openReceivableCents === ZERO ? "—" : percentOf(health.delinquencyBps)}
              hint={health.openReceivableCents === ZERO ? "Nada a receber em aberto" : `${formatCents(health.overdueReceivableCents)} vencidos de ${formatCents(health.openReceivableCents)} a receber`}
              tone={health.openReceivableCents === ZERO ? undefined : health.delinquencyBps >= 2_000 ? "bad" : health.delinquencyBps >= 1_000 ? "warn" : "good"}
            />
            <Indicator label="Prazo médio de recebimento" value={days(health.averageReceiveDays)} hint="Da competência à entrada do dinheiro (90 dias)" />
            <Indicator label="Prazo médio de pagamento" value={days(health.averagePayDays)} hint="Da competência à saída do dinheiro, sem faturas de cartão (90 dias)" />
            <Indicator
              label="Maior cliente"
              value={health.topClient ? percentOf(health.topClient.shareBps) : "—"}
              hint={health.topClient ? `${health.topClient.name} concentra essa fatia da receita do período` : "Sem receita com cliente informado no período"}
              tone={health.topClient ? (health.topClient.shareBps >= 4_000 ? "bad" : health.topClient.shareBps >= 2_500 ? "warn" : "good") : undefined}
            />
          </>
        )}
      </ul>
    </section>
  );
}
