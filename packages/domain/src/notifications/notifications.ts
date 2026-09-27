import { withCompanyContext } from "@ax-finance/db";
import { assertActiveMembership } from "../companies/assert-membership";

export async function listNotifications(userId: string, companyId: string, limit = 20) {
  await assertActiveMembership(userId, companyId);
  return withCompanyContext(userId, companyId, (tx) => tx.notification.findMany({
    where: { userId, companyId },
    orderBy: { createdAt: "desc" },
    take: Math.max(1, Math.min(50, Math.trunc(limit))),
  }));
}

export async function markNotificationRead(userId: string, companyId: string, notificationId: string) {
  await assertActiveMembership(userId, companyId);
  return withCompanyContext(userId, companyId, (tx) => tx.notification.updateMany({
    where: { id: notificationId, userId, companyId, readAt: null },
    data: { readAt: new Date() },
  }));
}

export async function markAllNotificationsRead(userId: string, companyId: string) {
  await assertActiveMembership(userId, companyId);
  return withCompanyContext(userId, companyId, (tx) => tx.notification.updateMany({
    where: { userId, companyId, readAt: null },
    data: { readAt: new Date() },
  }));
}
