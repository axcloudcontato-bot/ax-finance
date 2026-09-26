/**
 * Soma meses a uma data "YYYY-MM-DD" preservando o dia original quando
 * possível. Quando o mês de destino não tem esse dia (ex.: dia 31 em
 * fevereiro), cai no último dia daquele mês — mas sem arrastar o clamp para
 * os meses seguintes: o cálculo sempre parte do dia-âncora original, nunca do
 * resultado do mês anterior. Assim, dia 31 + 1 mês em fevereiro vira 28/29,
 * mas dia 31 + 2 meses (em março) volta a cair em 31 (Seção 11: política de
 * dia útil/clamp não pode ser aplicada silenciosamente nem gerar drift).
 */
export function addMonthsClamped(dateStr: string, months: number): string {
  const parts = dateStr.split("-").map(Number);
  const year = parts[0] ?? 0;
  const month = parts[1] ?? 1;
  const day = parts[2] ?? 1;
  const targetMonthIndex = (month - 1) + months;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;

  const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const clampedDay = Math.min(day, lastDayOfTargetMonth);

  const yyyy = String(targetYear).padStart(4, "0");
  const mm = String(targetMonth + 1).padStart(2, "0");
  const dd = String(clampedDay).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
