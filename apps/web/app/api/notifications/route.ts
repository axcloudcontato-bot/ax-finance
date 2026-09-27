import { z } from "zod";
import { markAllNotificationsRead, markNotificationRead } from "@ax-finance/domain";
import { requirePrimaryCompany } from "@/lib/company";
import { requireUser } from "@/lib/session";
import { errorResponse, json } from "@/lib/api";

const inputSchema = z.union([
  z.object({ id: z.string().uuid() }),
  z.object({ all: z.literal(true) }),
]);

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const company = await requirePrimaryCompany(user.id);
    const input = inputSchema.parse(await request.json());
    const result = "id" in input
      ? await markNotificationRead(user.id, company.id, input.id)
      : await markAllNotificationsRead(user.id, company.id);
    return json({ updated: result.count });
  } catch (error) {
    return errorResponse(error);
  }
}
