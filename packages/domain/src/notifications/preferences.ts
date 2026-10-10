import { z } from "zod";
import { withCompanyContext } from "@ax-finance/db";
import { assertActiveMembership } from "../companies/assert-membership";

export const notificationPreferenceInput = z.object({
  inAppDue: z.boolean(),
  emailDue: z.boolean(),
  inAppWeekly: z.boolean(),
  emailWeekly: z.boolean(),
  emailMonthlyReport: z.boolean().default(true),
  dueDaysAhead: z.number().int().min(0).max(30),
  deliveryHour: z.number().int().min(0).max(23),
});

export const DEFAULT_NOTIFICATION_PREFERENCE = {
  inAppDue: true,
  emailDue: true,
  inAppWeekly: true,
  emailWeekly: true,
  emailMonthlyReport: true,
  dueDaysAhead: 0,
  deliveryHour: 8,
} as const;

export async function getNotificationPreference(userId: string, companyId: string) {
  await assertActiveMembership(userId, companyId);
  return withCompanyContext(userId, companyId, async (tx) => {
    const preference = await tx.notificationPreference.findUnique({
      where: { userId_companyId: { userId, companyId } },
    });
    return preference ?? { id: null, userId, companyId, ...DEFAULT_NOTIFICATION_PREFERENCE };
  });
}

export async function updateNotificationPreference(userId: string, companyId: string, input: unknown) {
  await assertActiveMembership(userId, companyId);
  const data = notificationPreferenceInput.parse(input);
  return withCompanyContext(userId, companyId, (tx) => tx.notificationPreference.upsert({
    where: { userId_companyId: { userId, companyId } },
    create: { userId, companyId, ...data },
    update: data,
  }));
}
