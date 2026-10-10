import { z } from "zod";
import { withCompanyContext } from "@ax-finance/db";
import { assertActiveMembership } from "../companies/assert-membership";
import { computeAccountBalanceDeltas } from "../financial-accounts/account-balances";
import { OPERATIONAL_ACCOUNT } from "../financial-accounts/operational";
import { getCashFlowReport } from "./cash-flow-report";
import { projectCashBalances } from "./project-cash-balances";
import { companyToday } from "../shared/today";

const input = z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) });

const ZERO = BigInt(0);
const asDate = (value: string) => new Date(`${value}T00:00:00Z`);
const dateOnly = (value: Date) => value.toISOString().slice(0, 10);

export interface CalendarItem {
  id: string;
  type: "RECEIVABLE" | "PAYABLE";
  description: string;
  partyName: string | null;
  remainingCents: bigint;
  dueDate: string;
  /** Vencido antes de hoje e ainda em aberto. */
  overdue: boolean;
}

export interface CalendarDay {
  date: string;
  receivableCents: bigint;
  payableCents: bigint;
  items: CalendarItem[];
  /** Realizado no dia (baixas, já descontadas as taxas). */
  receivedCents: bigint;
  paidCents: bigint;
  /** Saldo previsto ao fim do dia: só de hoje em diante (antes de hoje vale o realizado). */
  projectedBalanceCents: bigint | null;
}

function lastDayOf(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number) as [number, number];
  const last = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return `${month}-${String(last).padStart(2, "0")}`;
}

function addDays(date: string, days: number): string {
  return dateOnly(new Date(asDate(date).getTime() + days * 86_400_000));
}

/**
 * Calendário do mês: o que vence em cada dia (a receber e a pagar, pelo saldo em aberto), o que foi
 * recebido/pago em cada dia e o saldo previsto ao fim de cada dia a partir de hoje. A projeção segue a
 * do painel: parte do saldo disponível de hoje (contas incluídas no total) e soma os títulos em aberto
 * na data de vencimento; os já vencidos entram hoje, como compromisso que ainda não saiu do caixa.
 */
export async function getFinancialCalendar(userId: string, companyId: string, rawInput: unknown) {
  const { month } = input.parse(rawInput);
  await assertActiveMembership(userId, companyId);
  const first = `${month}-01`;
  const last = lastDayOf(month);
  const cash = await getCashFlowReport(userId, companyId, { from: first, to: last });

  return withCompanyContext(userId, companyId, async (tx) => {
    const today = await companyToday(tx, companyId);
    const [accounts, deltas, openTitles] = await Promise.all([
      tx.financialAccount.findMany({ where: { companyId, status: "ACTIVE", includedInAvailableTotal: true, ...OPERATIONAL_ACCOUNT }, select: { id: true, openingBalanceCents: true, openingDate: true } }),
      computeAccountBalanceDeltas(tx, companyId, asDate(today)),
      // em aberto até o fim do mês: os do mês para o calendário e os anteriores para a projeção (vencidos entram hoje)
      tx.title.findMany({
        where: { companyId, deletedAt: null, status: { not: "CANCELLED" }, dueDate: { lte: asDate(last) } },
        select: {
          id: true, type: true, description: true, dueDate: true, originalAmountCents: true,
          party: { select: { name: true } },
          settlements: { where: { reversedAt: null, effectiveDate: { lte: asDate(today) } }, select: { principalAmountCents: true, discountCents: true } },
        },
        orderBy: [{ dueDate: "asc" }, { description: "asc" }],
      }),
    ]);

    const availableTodayCents = accounts
      .filter((account) => dateOnly(account.openingDate) <= today)
      .reduce((sum, account) => sum + account.openingBalanceCents + (deltas.get(account.id) ?? ZERO), ZERO);

    const items: CalendarItem[] = openTitles.map((title) => {
      const settled = title.settlements.reduce((sum, item) => sum + item.principalAmountCents + item.discountCents, ZERO);
      const dueDate = dateOnly(title.dueDate);
      return {
        id: title.id,
        type: title.type,
        description: title.description,
        partyName: title.party?.name ?? null,
        remainingCents: title.originalAmountCents - settled,
        dueDate,
        overdue: dueDate < today,
      };
    }).filter((item) => item.remainingCents > ZERO);

    const days: CalendarDay[] = [];
    for (let date = first; date <= last; date = addDays(date, 1)) {
      const dayItems = items.filter((item) => item.dueDate === date);
      days.push({
        date,
        receivableCents: dayItems.filter((item) => item.type === "RECEIVABLE").reduce((sum, item) => sum + item.remainingCents, ZERO),
        payableCents: dayItems.filter((item) => item.type === "PAYABLE").reduce((sum, item) => sum + item.remainingCents, ZERO),
        items: dayItems,
        receivedCents: ZERO,
        paidCents: ZERO,
        projectedBalanceCents: null,
      });
    }
    const byDate = new Map(days.map((day) => [day.date, day]));
    for (const entry of cash.entries) {
      const day = byDate.get(dateOnly(entry.effectiveDate));
      if (!day) continue;
      if (entry.titleType === "RECEIVABLE") day.receivedCents += entry.cashDeltaCents;
      else day.paidCents -= entry.cashDeltaCents;
    }

    const overdueItems = items.filter((item) => item.overdue);
    const projection = projectCashBalances(today, last, availableTodayCents, items);
    const projectedByDate = new Map(projection.series.map((day) => [day.date, day.plannedBalanceCents]));
    let lowest: { date: string; balanceCents: bigint } | null = null;
    for (const day of days) {
      day.projectedBalanceCents = projectedByDate.get(day.date) ?? null;
      if (day.projectedBalanceCents !== null && (!lowest || day.projectedBalanceCents < lowest.balanceCents)) lowest = { date: day.date, balanceCents: day.projectedBalanceCents };
    }

    const monthItems = items.filter((item) => item.dueDate >= first);
    return {
      month,
      today,
      availableTodayCents,
      days,
      overdue: {
        count: overdueItems.length,
        receivableCents: overdueItems.filter((item) => item.type === "RECEIVABLE").reduce((sum, item) => sum + item.remainingCents, ZERO),
        payableCents: overdueItems.filter((item) => item.type === "PAYABLE").reduce((sum, item) => sum + item.remainingCents, ZERO),
      },
      totals: {
        receivableCents: monthItems.filter((item) => item.type === "RECEIVABLE").reduce((sum, item) => sum + item.remainingCents, ZERO),
        payableCents: monthItems.filter((item) => item.type === "PAYABLE").reduce((sum, item) => sum + item.remainingCents, ZERO),
        receivedCents: days.reduce((sum, day) => sum + day.receivedCents, ZERO),
        paidCents: days.reduce((sum, day) => sum + day.paidCents, ZERO),
      },
      /** Menor saldo previsto do mês (null se o mês todo já passou). */
      lowest,
      /** Mês já encerrado: sem projeção. */
      past: last < today,
    };
  });
}
