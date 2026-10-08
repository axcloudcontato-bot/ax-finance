/** "62,5%", "104%": uma casa abaixo de 10%, inteiro a partir daí (sem arredondar para cima). */
export function formatPercent(value: number): string {
  const rounded = value >= 10 || Number.isInteger(value) ? Math.floor(value) : Math.floor(value * 10) / 10;
  return `${rounded.toLocaleString("pt-BR")}%`;
}
