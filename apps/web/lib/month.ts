/**
 * "YYYY-MM" é o formato usado na URL (?mes=) e nos helpers abaixo — sempre em
 * UTC, mesmo cuidado de fuso já usado em lib/dates.ts (evita o mês mudar um
 * dia antes/depois dependendo do fuso do servidor).
 */
export function currentYearMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export function isYearMonth(value: string | undefined | null): value is string {
  if (!value || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return false;
  return true;
}

export function isDateOnly(value: string | undefined | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export const PERIOD_PRESETS = ["hoje", "ultimos-7-dias", "trimestre", "ano"] as const;
export type PeriodPreset = typeof PERIOD_PRESETS[number];
export const COMPARISON_MODES = ["anterior", "ano-anterior"] as const;
export type ComparisonMode = typeof COMPARISON_MODES[number];

export interface PeriodInput {
  mes?: string;
  de?: string;
  ate?: string;
  periodo?: string;
  comparar?: string;
}

export type ResolvedPeriod =
  | { mode: "month"; month: string; from: string; to: string }
  | { mode: "custom"; month: string; from: string; to: string }
  | { mode: "preset"; preset: PeriodPreset; month: string; from: string; to: string };

export function isPeriodPreset(value: string | undefined | null): value is PeriodPreset {
  return !!value && PERIOD_PRESETS.includes(value as PeriodPreset);
}

export function isComparisonMode(value: string | undefined | null): value is ComparisonMode {
  return !!value && COMPARISON_MODES.includes(value as ComparisonMode);
}

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(value: string, delta: number) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return dateOnly(date);
}

function presetRange(preset: PeriodPreset, now: Date) {
  const today = dateOnly(now);
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  if (preset === "hoje") return { from: today, to: today };
  if (preset === "ultimos-7-dias") return { from: addDays(today, -6), to: today };
  if (preset === "trimestre") {
    const quarterStartMonth = Math.floor(month / 3) * 3;
    return {
      from: dateOnly(new Date(Date.UTC(year, quarterStartMonth, 1))),
      to: dateOnly(new Date(Date.UTC(year, quarterStartMonth + 3, 0))),
    };
  }
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

export function resolvePeriodRange(input: PeriodInput, now = new Date()): ResolvedPeriod {
  if (isPeriodPreset(input.periodo)) {
    const range = presetRange(input.periodo, now);
    return { mode: "preset", preset: input.periodo, month: range.to.slice(0, 7), ...range };
  }
  if (isDateOnly(input.de) && isDateOnly(input.ate) && input.de <= input.ate) {
    return { mode: "custom" as const, month: input.de.slice(0, 7), from: input.de, to: input.ate };
  }
  const month = isYearMonth(input.mes) ? input.mes : currentYearMonth();
  return { mode: "month" as const, month, ...monthRange(month) };
}

function shiftYear(value: string, delta: number) {
  const [year, month, day] = value.split("-").map(Number);
  const targetYear = year! + delta;
  const lastDay = new Date(Date.UTC(targetYear, month!, 0)).getUTCDate();
  return `${String(targetYear).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(Math.min(day!, lastDay)).padStart(2, "0")}`;
}

export function comparisonRange(period: ResolvedPeriod, mode: ComparisonMode) {
  if (mode === "ano-anterior") {
    return { from: shiftYear(period.from, -1), to: shiftYear(period.to, -1), label: "Ano anterior" };
  }
  if (period.mode === "month") {
    const range = monthRange(addMonths(period.month, -1));
    return { ...range, label: "Período anterior" };
  }
  if (period.mode === "preset" && period.preset === "trimestre") {
    const previousEnd = addDays(period.from, -1);
    const previousStartMonth = addMonths(period.from.slice(0, 7), -3);
    return { from: `${previousStartMonth}-01`, to: previousEnd, label: "Período anterior" };
  }
  if (period.mode === "preset" && period.preset === "ano") {
    return { from: shiftYear(period.from, -1), to: shiftYear(period.to, -1), label: "Período anterior" };
  }
  const days = Math.round((new Date(`${period.to}T00:00:00.000Z`).getTime()
    - new Date(`${period.from}T00:00:00.000Z`).getTime()) / 86_400_000) + 1;
  const to = addDays(period.from, -1);
  return { from: addDays(to, -(days - 1)), to, label: "Período anterior" };
}

export function resolveComparison(input: PeriodInput, period: ResolvedPeriod) {
  if (!isComparisonMode(input.comparar)) return null;
  return { mode: input.comparar, ...comparisonRange(period, input.comparar) };
}

export function periodQuery(period: ResolvedPeriod, comparison?: ComparisonMode | null) {
  const params = new URLSearchParams();
  if (period.mode === "month") params.set("mes", period.month);
  else if (period.mode === "preset") params.set("periodo", period.preset);
  else {
    params.set("de", period.from);
    params.set("ate", period.to);
  }
  if (comparison) params.set("comparar", comparison);
  return params.toString();
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
