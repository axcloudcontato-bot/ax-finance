type Range = { from: string; to: string; label: string };

/** Compara realizado com a mesma quantidade de dias decorridos, quando a seleção inclui futuro. */
export function alignRealizedComparison<T extends Range>(period: { from: string; to: string }, comparison: T | null, today: string): T | null {
  if (!comparison || period.to <= today) return comparison;
  if (period.from > today) return null;
  const elapsed = Date.parse(today) - Date.parse(period.from);
  const end = new Date(Date.parse(comparison.from) + elapsed).toISOString().slice(0, 10);
  return { ...comparison, to: end < comparison.to ? end : comparison.to };
}
