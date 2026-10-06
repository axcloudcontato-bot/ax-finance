/**
 * Datas "somente calendário" (competência, vencimento, data efetiva, saldo de
 * abertura) vêm do Postgres como `@db.Date` — sem fuso, só ano/mês/dia — e o
 * Prisma as representa como Date UTC-meia-noite. Formatar com o fuso local
 * (padrão do toLocaleDateString) desloca o dia exibido sempre que o fuso do
 * servidor está atrás de UTC (ex.: America/Sao_Paulo, UTC-3): 2026-09-25 vira
 * "24/09/2026" na tela. Por isso toda data-calendário deste app é formatada
 * fixando o fuso em UTC.
 */
export function formatDateOnly(date: Date | string): string {
  return new Date(date).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

/**
 * "YYYY-MM-DD" a partir dos componentes UTC — para comparar duas datas de
 * calendário (vencido/hoje/próxima) sem o Date object reintroduzir o mesmo
 * deslocamento de fuso que `formatDateOnly` evita na exibição.
 */
export function toDateOnlyString(date: Date | string): string {
  return new Date(date).toISOString().slice(0, 10);
}

/** Fuso do calendário do app. Mesmo valor de DEFAULT_TIME_ZONE no domínio (toda empresa nasce com ele). */
export const APP_TIME_ZONE = "America/Sao_Paulo";

/**
 * "Hoje" ("YYYY-MM-DD") em Brasília. Com UTC, depois das 21h o dia já viraria: o "vencido" apareceria
 * uma noite antes e a data padrão de um lançamento sairia como amanhã.
 */
export function todayDateOnlyString(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Data de calendário de hoje como Date em UTC ao meio-dia: `getUTC*` devolve o dia certo em qualquer servidor. */
export function calendarNow(now: Date = new Date()): Date {
  return new Date(`${todayDateOnlyString(now)}T12:00:00.000Z`);
}
