/**
 * "YYYY-MM" é o formato usado na URL (?mes=) e nos helpers abaixo — sempre em
 * UTC, mesmo cuidado de fuso já usado em lib/dates.ts (evita o mês mudar um
 * dia antes/depois dependendo do fuso do servidor).
 */
export function currentYearMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export function addMonths(yearMonth: string, delta: number): string {
  const [year, month] = yearMonth.split("-").map(Number);
  const totalMonths = (year! * 12 + (month! - 1)) + delta;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth = ((totalMonths % 12) + 12) % 12;
  return `${String(targetYear).padStart(4, "0")}-${String(targetMonth + 1).padStart(2, "0")}`;
}

export function monthLabel(yearMonth: string): string {
  const date = new Date(`${yearMonth}-01T00:00:00.000Z`);
  const label = date.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function monthRange(yearMonth: string): { from: string; to: string } {
  const [year, month] = yearMonth.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year!, month!, 0)).getUTCDate();
  return {
    from: `${yearMonth}-01`,
    to: `${yearMonth}-${String(lastDay).padStart(2, "0")}`,
  };
}
