import { revokeSession } from "@ax-finance/domain";
import { json, errorResponse } from "@/lib/api";
import { clearMfaChallengeCookie, clearSessionCookie, getSessionToken } from "@/lib/session";

export async function POST() {
  try {
    const token = await getSessionToken();
    if (token) {
      await revokeSession(token);
    }
    await clearSessionCookie();
    await clearMfaChallengeCookie();
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
