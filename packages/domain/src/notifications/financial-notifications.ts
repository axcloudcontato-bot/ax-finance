import { withCompanyContext } from "@ax-finance/db";
import { assertActiveMembership } from "../companies/assert-membership";
import { enqueueDueDateSummaryEmail, enqueueWeeklySummaryEmail } from "../outbox/events";

const EMAIL_ROLES = new Set(["OWNER", "FINANCE_ADMIN", "ACCOUNTANT"]);

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function dateOnlyInTimezone(date: Date, timezone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${value.year}-${value.month}-${value.day}`;
  } catch {
    return dateOnly(date);
  }
}

function addDays(date: string, days: number) {
  const result = new Date(`${date}T00:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function remainingCents(title: {
  originalAmountCents: bigint;
  settlements: Array<{ principalAmountCents: bigint; reversedAt: Date | null }>;
}) {
  return title.originalAmountCents - title.settlements.reduce(
    (sum, settlement) => sum + (settlement.reversedAt ? BigInt(0) : settlement.principalAmountCents),
    BigInt(0)
  );
}

export async function generateDueNotifications(
  userId: string,
  companyId: string,
  baseUrl: string,
  now = new Date()
) {
  await assertActiveMembership(userId, companyId);
  return withCompanyContext(userId, companyId, async (tx) => {
    const company = await tx.company.findUniqueOrThrow({ where: { id: companyId } });
    const today = dateOnlyInTimezone(now, company.timezone);
    const [titles, memberships] = await Promise.all([
      tx.title.findMany({
        where: {
          companyId,
          status: { in: ["OPEN", "PARTIALLY_SETTLED"] },
          dueDate: { lte: new Date(`${today}T00:00:00Z`) },
        },
        orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
        include: { settlements: true },
        take: 50,
      }),
      tx.membership.findMany({
        where: { companyId, status: "ACTIVE" },
        include: { user: true },
      }),
    ]);

    const pendingTitles = titles.filter((title) => remainingCents(title) > BigInt(0));
    if (pendingTitles.length === 0) return { notificationsCreated: 0, emailsQueued: 0 };

    const notificationRows = memberships.flatMap((membership) => pendingTitles.map((title) => {
      const overdue = dateOnly(title.dueDate) < today;
      const href = title.type === "RECEIVABLE" ? `/entradas/${title.id}` : `/saidas/${title.id}`;
      return {
        companyId,
        userId: membership.userId,
        type: overdue ? "TITLE_OVERDUE" as const : "TITLE_DUE_TODAY" as const,
        dedupKey: `${overdue ? "overdue" : "due-today"}:${membership.userId}:${title.id}:${dateOnly(title.dueDate)}`,
        title: overdue ? "Título vencido" : "Título vence hoje",
        body: `${title.type === "RECEIVABLE" ? "Entrada" : "Saída"}: ${title.description}`,
        href,
      };
    }));
    const created = await tx.notification.createMany({ data: notificationRows, skipDuplicates: true });

    let emailsQueued = 0;
    for (const membership of memberships) {
      if (!EMAIL_ROLES.has(membership.role) || !membership.user.emailVerifiedAt) continue;
      const queued = await enqueueDueDateSummaryEmail(
        tx,
        `due-summary:${companyId}:${membership.userId}:${today}`,
        {
          to: membership.user.email,
          name: membership.user.name,
          companyName: company.name,
          baseUrl,
          items: pendingTitles.map((title) => ({
            type: title.type,
            description: title.description,
            dueDate: dateOnly(title.dueDate),
            overdue: dateOnly(title.dueDate) < today,
            href: title.type === "RECEIVABLE" ? `/entradas/${title.id}` : `/saidas/${title.id}`,
          })),
        }
      );
      emailsQueued += queued.count;
    }

    return { notificationsCreated: created.count, emailsQueued };
  });
}

export async function generateWeeklySummary(
  userId: string,
  companyId: string,
  baseUrl: string,
  now = new Date()
) {
  await assertActiveMembership(userId, companyId);
  return withCompanyContext(userId, companyId, async (tx) => {
    const company = await tx.company.findUniqueOrThrow({ where: { id: companyId } });
    const today = dateOnlyInTimezone(now, company.timezone);
    const todayAsDate = new Date(`${today}T00:00:00Z`);
    const next7 = addDays(today, 7);
    const [titles, memberships] = await Promise.all([
      tx.title.findMany({
        where: { companyId, status: { in: ["OPEN", "PARTIALLY_SETTLED"] } },
        include: { settlements: true },
      }),
      tx.membership.findMany({
        where: { companyId, status: "ACTIVE" },
        include: { user: true },
      }),
    ]);
    const openTitles = titles.filter((title) => remainingCents(title) > BigInt(0));
    const receivableOpenCents = openTitles
      .filter((title) => title.type === "RECEIVABLE")
      .reduce((sum, title) => sum + remainingCents(title), BigInt(0));
    const payableOpenCents = openTitles
      .filter((title) => title.type === "PAYABLE")
      .reduce((sum, title) => sum + remainingCents(title), BigInt(0));
    const overdueCount = openTitles.filter((title) => dateOnly(title.dueDate) < today).length;
    const dueNext7Count = openTitles.filter((title) => title.dueDate >= todayAsDate && title.dueDate <= next7).length;
    const year = todayAsDate.getUTCFullYear();
    const weekKey = `${year}-${String(Math.ceil((((todayAsDate.getTime() - Date.UTC(year, 0, 1)) / 86400000) + new Date(Date.UTC(year, 0, 1)).getUTCDay() + 1) / 7)).padStart(2, "0")}`;

    const created = await tx.notification.createMany({
      data: memberships.map((membership) => ({
        companyId,
        userId: membership.userId,
        type: "WEEKLY_SUMMARY" as const,
        dedupKey: `weekly-summary:${companyId}:${membership.userId}:${weekKey}`,
        title: "Resumo financeiro semanal",
        body: `${overdueCount} vencido(s) e ${dueNext7Count} título(s) para os próximos 7 dias.`,
        href: "/relatorios/fluxo-de-caixa",
      })),
      skipDuplicates: true,
    });

    let emailsQueued = 0;
    for (const membership of memberships) {
      if (!EMAIL_ROLES.has(membership.role) || !membership.user.emailVerifiedAt) continue;
      const queued = await enqueueWeeklySummaryEmail(
        tx,
        `weekly-summary:${companyId}:${membership.userId}:${weekKey}`,
        {
          to: membership.user.email,
          name: membership.user.name,
          companyName: company.name,
          baseUrl,
          receivableOpenCents: receivableOpenCents.toString(),
          payableOpenCents: payableOpenCents.toString(),
          overdueCount,
          dueNext7Count,
        }
      );
      emailsQueued += queued.count;
    }
    return { notificationsCreated: created.count, emailsQueued };
  });
}
