export function formatPercentageChange(current: bigint, previous: bigint) {
  if (previous === BigInt(0)) return current === BigInt(0) ? "0%" : "Sem base comparável";
  const denominator = previous < BigInt(0) ? -previous : previous;
  const percent = Number(((current - previous) * BigInt(10_000)) / denominator) / 100;
  const sign = percent > 0 ? "+" : "";
  return `${sign}${percent.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}
