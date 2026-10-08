import { z } from "zod";

export const reportDate = z.preprocess(
  (value) => value instanceof Date && !Number.isNaN(value.getTime()) ? value.toISOString().slice(0, 10) : value,
  z.string().date("Informe uma data de calendário válida.")
);

export const reportPeriod = z.object({ from: reportDate, to: reportDate }).refine(
  ({ from, to }) => from <= to,
  { path: ["to"], message: "O fim do período deve ser igual ou posterior ao início." }
);

export function addReportDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
