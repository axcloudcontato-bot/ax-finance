import { revokeSession } from "@ax-finance/domain";
import { json, errorResponse } from "@/lib/api";
import { clearSessionCookie, getSessionToken } from "@/lib/session";

export async function POST() {
  try {
    const token = getSessionToken();
    if (token) {
      await revokeSession(token);
    }
    clearSessionCookie();
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
