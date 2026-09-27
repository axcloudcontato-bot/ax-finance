import { withCompanyContext } from "@ax-finance/db";
import { assertActiveMembership } from "../companies/assert-membership";
import { enqueueDueDateSummaryEmail, enqueueWeeklySummaryEmail } from "../outbox/events";
import { DEFAULT_NOTIFICATION_PREFERENCE } from "./preferences";

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

function hourInTimezone(date: Date, timezone: string) {
  try {
    return Number(new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date).find((part) => part.type === "hour")?.value ?? "0");
  } catch {
    return date.getUTCHours();
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
    const localHour = hourInTimezone(now, company.timezone);
    const [memberships, storedPreferences] = await Promise.all([
      tx.membership.findMany({
        where: { companyId, status: "ACTIVE" },
        include: { user: true },
      }),
      tx.notificationPreference.findMany({ where: { companyId } }),
    ]);
    const preferenceByUser = new Map(storedPreferences.map((preference) => [preference.userId, preference]));
    const eligibleMemberships = memberships.filter((membership) => {
      const preference = preferenceByUser.get(membership.userId) ?? DEFAULT_NOTIFICATION_PREFERENCE;
      return localHour >= preference.deliveryHour;
    });
    if (eligibleMemberships.length === 0) return { notificationsCreated: 0, emailsQueued: 0 };
    const maxDaysAhead = Math.max(...eligibleMemberships.map((membership) => (
      preferenceByUser.get(membership.userId) ?? DEFAULT_NOTIFICATION_PREFERENCE
    ).dueDaysAhead));
    const titles = await tx.title.findMany({
      where: {
        companyId,
        status: { in: ["OPEN", "PARTIALLY_SETTLED"] },
        dueDate: { lte: addDays(today, maxDaysAhead) },
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
      include: { settlements: true },
      take: 50,
    });

    const pendingTitles = titles.filter((title) => remainingCents(title) > BigInt(0));
    if (pendingTitles.length === 0) return { notificationsCreated: 0, emailsQueued: 0 };

    const notificationRows = eligibleMemberships.flatMap((membership) => {
      const preference = preferenceByUser.get(membership.userId) ?? DEFAULT_NOTIFICATION_PREFERENCE;
      if (!preference.inAppDue) return [];
      const cutoff = dateOnly(addDays(today, preference.dueDaysAhead));
      return pendingTitles.filter((title) => dateOnly(title.dueDate) <= cutoff).map((title) => {
      const overdue = dateOnly(title.dueDate) < today;
      const dueToday = dateOnly(title.dueDate) === today;
      const href = title.type === "RECEIVABLE" ? `/entradas/${title.id}` : `/saidas/${title.id}`;
      return {
        companyId,
        userId: membership.userId,
        type: overdue ? "TITLE_OVERDUE" as const : dueToday ? "TITLE_DUE_TODAY" as const : "TITLE_DUE_SOON" as const,
        dedupKey: `${overdue ? "overdue" : dueToday ? "due-today" : "due-soon"}:${membership.userId}:${title.id}:${dateOnly(title.dueDate)}`,
        title: overdue ? "Título vencido" : dueToday ? "Título vence hoje" : "Título próximo do vencimento",
        body: `${title.type === "RECEIVABLE" ? "Entrada" : "Saída"}: ${title.description}${dueToday || overdue ? "" : ` · vence em ${dateOnly(title.dueDate).split("-").reverse().join("/")}`}`,
        href,
      };
    });
    });
    const created = await tx.notification.createMany({ data: notificationRows, skipDuplicates: true });

    let emailsQueued = 0;
    for (const membership of eligibleMemberships) {
      const preference = preferenceByUser.get(membership.userId) ?? DEFAULT_NOTIFICATION_PREFERENCE;
      if (!preference.emailDue || !membership.user.emailVerifiedAt) continue;
      const cutoff = dateOnly(addDays(today, preference.dueDaysAhead));
      const userTitles = pendingTitles.filter((title) => dateOnly(title.dueDate) <= cutoff);
      if (userTitles.length === 0) continue;
      const queued = await enqueueDueDateSummaryEmail(
        tx,
        `due-summary:${companyId}:${membership.userId}:${today}`,
        {
          to: membership.user.email,
          name: membership.user.name,
          companyName: company.name,
          baseUrl,
          items: userTitles.map((title) => ({
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
    const localHour = hourInTimezone(now, company.timezone);
    if (todayAsDate.getUTCDay() !== 1) return { notificationsCreated: 0, emailsQueued: 0 };
    const next7 = addDays(today, 7);
    const [titles, memberships, storedPreferences] = await Promise.all([
      tx.title.findMany({
        where: { companyId, status: { in: ["OPEN", "PARTIALLY_SETTLED"] } },
        include: { settlements: true },
      }),
      tx.membership.findMany({
        where: { companyId, status: "ACTIVE" },
        include: { user: true },
      }),
      tx.notificationPreference.findMany({ where: { companyId } }),
    ]);
    const preferenceByUser = new Map(storedPreferences.map((preference) => [preference.userId, preference]));
    const eligibleMemberships = memberships.filter((membership) => {
      const preference = preferenceByUser.get(membership.userId) ?? DEFAULT_NOTIFICATION_PREFERENCE;
      return localHour >= preference.deliveryHour;
    });
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
      data: eligibleMemberships.filter((membership) => (
        preferenceByUser.get(membership.userId) ?? DEFAULT_NOTIFICATION_PREFERENCE
      ).inAppWeekly).map((membership) => ({
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
    for (const membership of eligibleMemberships) {
      const preference = preferenceByUser.get(membership.userId) ?? DEFAULT_NOTIFICATION_PREFERENCE;
      if (!preference.emailWeekly || !membership.user.emailVerifiedAt) continue;
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
