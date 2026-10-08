/** Ícones e cores que o cofrinho pode ter (o front desenha cada um). */
export const SAVINGS_GOAL_ICONS = ["piggy", "plane", "home", "car", "shield", "gift", "education", "health", "briefcase", "star"] as const;
export const SAVINGS_GOAL_COLORS = ["blue", "green", "purple", "orange", "pink", "teal", "yellow", "red"] as const;
export type SavingsGoalIcon = (typeof SAVINGS_GOAL_ICONS)[number];
export type SavingsGoalColor = (typeof SAVINGS_GOAL_COLORS)[number];

export type SavingsGoalPace =
  /** Já chegou na meta. */
  | "REACHED"
  /** Sem prazo: não há ritmo a acompanhar. */
  | "NO_DEADLINE"
  /** Guardado até hoje ≥ o esperado proporcional ao tempo. */
  | "ON_TRACK"
  | "BEHIND"
  /** O prazo passou e a meta não foi atingida. */
  | "OVERDUE";

export interface SavingsGoalProgress {
  balanceCents: bigint;
  targetCents: bigint;
  /** Percentual real, com duas casas (pode passar de 100). */
  percent: number;
  /** Para desenhar a barra: 0 a 100. */
  barPercent: number;
  remainingCents: bigint;
  reached: boolean;
  /** Meses de depósito até o prazo, contando o atual (null sem prazo; 0 com prazo vencido). */
  monthsLeft: number | null;
  /** Quanto guardar por mês para chegar no prazo (null sem prazo, já atingida ou prazo vencido). */
  monthlySuggestionCents: bigint | null;
  pace: SavingsGoalPace;
}

const ZERO = BigInt(0);

function parts(date: string) {
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  return { year, month, day };
}

/** "Hoje" e prazo como "YYYY-MM-DD". 09/10 → 31/12 = 3 (out, nov, dez); 09/10 → 05/11 = 1. */
export function monthsUntil(today: string, targetDate: string): number {
  if (targetDate < today) return 0;
  const from = parts(today);
  const to = parts(targetDate);
  const diff = (to.year - from.year) * 12 + (to.month - from.month);
  return Math.max(1, diff + (to.day >= from.day ? 1 : 0));
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export function computeSavingsGoalProgress(input: {
  balanceCents: bigint;
  targetCents: bigint;
  /** "YYYY-MM-DD" ou null. */
  targetDate: string | null;
  /** Dia em que o cofrinho foi criado, "YYYY-MM-DD" (início do ritmo esperado). */
  startDate: string;
  today: string;
}): SavingsGoalProgress {
  const { balanceCents, targetCents, targetDate, startDate, today } = input;
  const balance = balanceCents > ZERO ? balanceCents : ZERO;
  const percent = targetCents > ZERO ? Number((balance * BigInt(10000)) / targetCents) / 100 : 0;
  const barPercent = Math.min(100, Math.max(0, percent));
  const remainingCents = targetCents > balance ? targetCents - balance : ZERO;
  const reached = targetCents > ZERO && balance >= targetCents;
  const monthsLeft = targetDate ? monthsUntil(today, targetDate) : null;
  const monthlySuggestionCents = !reached && monthsLeft && monthsLeft > 0
    ? (remainingCents + BigInt(monthsLeft - 1)) / BigInt(monthsLeft)
    : null;

  let pace: SavingsGoalPace;
  if (reached) pace = "REACHED";
  else if (!targetDate) pace = "NO_DEADLINE";
  else if (targetDate < today) pace = "OVERDUE";
  else {
    const total = Math.max(1, daysBetween(startDate, targetDate));
    const elapsed = Math.min(total, Math.max(0, daysBetween(startDate, today)));
    const expected = (targetCents * BigInt(elapsed)) / BigInt(total);
    pace = balance >= expected ? "ON_TRACK" : "BEHIND";
  }

  return { balanceCents: balance, targetCents, percent, barPercent, remainingCents, reached, monthsLeft, monthlySuggestionCents, pace };
}
