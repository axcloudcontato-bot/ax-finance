import type { TenantScopedClient } from "@ax-finance/db";
import { withCompanyContext } from "@ax-finance/db";

/** Fuso usado quando a empresa não tem um cadastrado (todas nascem com este). */
export const DEFAULT_TIME_ZONE = "America/Sao_Paulo";

/**
 * "Hoje" ("YYYY-MM-DD") num fuso. Em UTC, depois das 21h em Brasília já seria amanhã: um título
 * apareceria como vencido uma noite antes, e uma compra de véspera de fechamento cairia na fatura
 * errada. As datas de calendário do banco (`@db.Date`) não têm fuso; é "hoje" que precisa tê-lo.
 */
export function todayInTimeZone(timeZone: string = DEFAULT_TIME_ZONE, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** "Hoje" no fuso cadastrado da empresa, dentro de uma transação já aberta. */
export async function companyToday(tx: TenantScopedClient, companyId: string, now: Date = new Date()): Promise<string> {
  const company = await tx.company.findUnique({ where: { id: companyId }, select: { timezone: true } });
  return todayInTimeZone(company?.timezone || DEFAULT_TIME_ZONE, now);
}

/** Mesmo que `companyToday`, para quem ainda não abriu transação. */
export function getCompanyToday(userId: string, companyId: string, now: Date = new Date()): Promise<string> {
  return withCompanyContext(userId, companyId, (tx) => companyToday(tx, companyId, now));
}
