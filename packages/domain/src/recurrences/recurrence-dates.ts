import { addMonthsClamped } from "../titles/installment-dates";

/**
 * Sequência mensal de ocorrências de uma recorrência (Seção 11): começa no
 * mês de `startDate`, usando `dayOfMonth` como dia-âncora (clampado por mês
 * via addMonthsClamped, sem drift entre meses); descarta a primeira
 * ocorrência se cair antes de `startDate` (ex.: início dia 15 com
 * vencimento no dia 5 começa no mês seguinte); para no `endDate` (se houver)
 * ou no `horizon`.
 */
export function computeOccurrenceDates(
  startDate: string,
  dayOfMonth: number,
  endDate: string | null,
  horizon: string
): string[] {
  const [year, month] = startDate.split("-").map(Number);
  const anchor = `${year}-${month}-${dayOfMonth}`;
  const dates: string[] = [];

  for (let offset = 0; offset < 600; offset++) {
    const candidate = addMonthsClamped(anchor, offset);
    if (candidate > horizon) break;
    if (endDate && candidate > endDate) break;
    if (candidate < startDate) continue;
    dates.push(candidate);
  }

  return dates;
}
