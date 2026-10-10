import Link from "next/link";
import { redirect } from "next/navigation";
import { getFinancialCalendar, type CalendarDay } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { formatCents } from "@/lib/currency";
import { formatDateOnly } from "@/lib/dates";
import { addMonths, currentYearMonth, isDateOnly, isYearMonth, monthLabel } from "@/lib/month";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const ZERO = BigInt(0);

/** Valor curto para caber na célula: R$ 1,2 mil, R$ 15 mil, R$ 980. */
function short(cents: bigint): string {
  const value = Number(cents) / 100;
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `R$ ${(value / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (abs >= 10_000) return `R$ ${Math.round(value / 1000).toLocaleString("pt-BR")} mil`;
  if (abs >= 1_000) return `R$ ${(value / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return `R$ ${Math.round(value).toLocaleString("pt-BR")}`;
}

function dayHref(month: string, date: string) {
  return `/calendario?mes=${month}&dia=${date}#dia`;
}

function DayDetail({ day, today }: { day: CalendarDay; today: string }) {
  const receivables = day.items.filter((item) => item.type === "RECEIVABLE");
  const payables = day.items.filter((item) => item.type === "PAYABLE");
  const list = (items: CalendarDay["items"], base: string) => (
    <ul className="calendar-items">
      {items.map((item) => (
        <li key={item.id}>
          <Link href={`${base}/${item.id}`}>
            <span><strong>{item.description}</strong>{item.partyName ? <small>{item.partyName}</small> : null}</span>
            <em className={item.type === "RECEIVABLE" ? "positive" : "negative"}>{formatCents(item.remainingCents)}</em>
          </Link>
        </li>
      ))}
    </ul>
  );
  return (
    <section className="card calendar-detail" id="dia" aria-label={`Movimentos de ${formatDateOnly(day.date)}`}>
      <div className="workspace-card-heading">
        <div>
          <h2>{formatDateOnly(day.date)}{day.date === today ? " · hoje" : ""}</h2>
          <p>{day.projectedBalanceCents !== null ? <>Saldo previsto ao fim do dia: <strong className={day.projectedBalanceCents < ZERO ? "negative" : undefined}>{formatCents(day.projectedBalanceCents)}</strong></> : "Dia que já passou: valem os recebimentos e pagamentos registrados."}</p>
        </div>
      </div>
      {day.receivedCents > ZERO || day.paidCents > ZERO ? (
        <p className="calendar-realized">Realizado no dia: <span className="positive">recebido {formatCents(day.receivedCents)}</span> · <span className="negative">pago {formatCents(day.paidCents)}</span></p>
      ) : null}
      {day.items.length === 0 ? <p className="muted">Nada em aberto vencendo neste dia.</p> : (
        <div className="calendar-detail-columns">
          <div><h3>A receber · {formatCents(day.receivableCents)}</h3>{receivables.length ? list(receivables, "/entradas") : <p className="muted">Nada.</p>}</div>
          <div><h3>A pagar · {formatCents(day.payableCents)}</h3>{payables.length ? list(payables, "/saidas") : <p className="muted">Nada.</p>}</div>
        </div>
      )}
    </section>
  );
}

export default async function CalendarPage(props: { searchParams: Promise<{ mes?: string; dia?: string }> }) {
  const searchParams = await props.searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await requirePrimaryCompany(user.id);

  const month = isYearMonth(searchParams.mes) ? searchParams.mes : currentYearMonth();
  const calendar = await getFinancialCalendar(user.id, company.id, { month });
  const selected = isDateOnly(searchParams.dia) && searchParams.dia.startsWith(month)
    ? calendar.days.find((day) => day.date === searchParams.dia)
    : calendar.days.find((day) => day.date === calendar.today);
  const leading = new Date(`${month}-01T00:00:00Z`).getUTCDay();
  const thisMonth = month === calendar.today.slice(0, 7);

  return (
    <main className="wide calendar-page">
      <div className="page-header">
        <div><h1>Calendário financeiro</h1><p className="subtitle">O que vence em cada dia e como fica o saldo, contando o disponível de hoje e tudo o que está em aberto.</p></div>
        <nav className="calendar-nav" aria-label="Mudar de mês">
          <Link href={`/calendario?mes=${addMonths(month, -1)}`} className="button-link" aria-label="Mês anterior">‹</Link>
          <strong>{monthLabel(month)}</strong>
          <Link href={`/calendario?mes=${addMonths(month, 1)}`} className="button-link" aria-label="Próximo mês">›</Link>
          {!thisMonth ? <Link href="/calendario" className="button-link">Hoje</Link> : null}
        </nav>
      </div>

      <section className="workspace-metrics calendar-metrics" aria-label="Resumo do mês">
        <div className="workspace-metric">
          <span className="workspace-metric-label">A receber no mês</span>
          <strong className="positive">{formatCents(calendar.totals.receivableCents)}</strong>
          <span className="workspace-metric-detail">Recebido até agora: {formatCents(calendar.totals.receivedCents)}</span>
        </div>
        <div className="workspace-metric">
          <span className="workspace-metric-label">A pagar no mês</span>
          <strong className="negative">{formatCents(calendar.totals.payableCents)}</strong>
          <span className="workspace-metric-detail">Pago até agora: {formatCents(calendar.totals.paidCents)}</span>
        </div>
        <div className="workspace-metric">
          <span className="workspace-metric-label">{calendar.past ? "Saldo disponível hoje" : "Menor saldo previsto"}</span>
          <strong className={(calendar.lowest?.balanceCents ?? calendar.availableTodayCents) < ZERO ? "negative" : undefined}>{formatCents(calendar.lowest?.balanceCents ?? calendar.availableTodayCents)}</strong>
          <span className="workspace-metric-detail">{calendar.lowest ? `em ${formatDateOnly(calendar.lowest.date)}` : "Mês encerrado: sem projeção"}{calendar.overdue.count > 0 ? ` · inclui ${calendar.overdue.count} ${calendar.overdue.count === 1 ? "título vencido" : "títulos vencidos"} contados hoje` : ""}</span>
        </div>
      </section>

      <div className="calendar-layout">
        <section className="card calendar-card" aria-label={`Calendário de ${monthLabel(month)}`}>
          <div className="calendar-grid" role="grid">
            {WEEKDAYS.map((weekday) => <span key={weekday} className="calendar-weekday" role="columnheader">{weekday}</span>)}
            {Array.from({ length: leading }, (_, index) => <span key={`vazio-${index}`} className="calendar-cell is-empty" aria-hidden="true" />)}
            {calendar.days.map((day) => {
              const classes = ["calendar-cell"];
              if (day.date === calendar.today) classes.push("is-today");
              if (day.date < calendar.today) classes.push("is-past");
              if (selected?.date === day.date) classes.push("is-selected");
              if (day.projectedBalanceCents !== null && day.projectedBalanceCents < ZERO) classes.push("is-negative");
              return (
                <Link key={day.date} href={dayHref(month, day.date)} className={classes.join(" ")} role="gridcell" aria-label={`${formatDateOnly(day.date)}: a receber ${formatCents(day.receivableCents)}, a pagar ${formatCents(day.payableCents)}`}>
                  <span className="calendar-day-number">{Number(day.date.slice(8))}</span>
                  {day.receivableCents > ZERO ? <span className="calendar-amount positive">+ {short(day.receivableCents)}</span> : null}
                  {day.payableCents > ZERO ? <span className="calendar-amount negative">− {short(day.payableCents)}</span> : null}
                  {day.projectedBalanceCents !== null && (day.items.length > 0 || day.date === calendar.today) ? <span className="calendar-balance">{short(day.projectedBalanceCents)}</span> : null}
                </Link>
              );
            })}
          </div>
          <p className="calendar-legend"><span className="positive">+ a receber</span><span className="negative">− a pagar</span><span>saldo previsto ao fim do dia</span></p>
        </section>

        {selected ? <DayDetail day={selected} today={calendar.today} /> : null}
      </div>

      {/* No celular, a agenda em lista é mais legível que a grade. */}
      <section className="card calendar-agenda" aria-label="Agenda do mês">
        <h2>Agenda de {monthLabel(month)}</h2>
        {calendar.days.filter((day) => day.items.length > 0).length === 0 ? <p className="muted">Nada em aberto vencendo neste mês.</p> : (
          <ul>
            {calendar.days.filter((day) => day.items.length > 0).map((day) => (
              <li key={day.date}>
                <Link href={dayHref(month, day.date)}>
                  <strong>{formatDateOnly(day.date)}</strong>
                  <span>{day.receivableCents > ZERO ? <em className="positive">+ {formatCents(day.receivableCents)}</em> : null}{day.payableCents > ZERO ? <em className="negative">− {formatCents(day.payableCents)}</em> : null}</span>
                  {day.projectedBalanceCents !== null ? <small className={day.projectedBalanceCents < ZERO ? "negative" : undefined}>saldo {formatCents(day.projectedBalanceCents)}</small> : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
