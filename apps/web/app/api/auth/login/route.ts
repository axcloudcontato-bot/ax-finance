import type { NextRequest } from "next/server";
import { login } from "@ax-finance/domain";
import { json, errorResponse } from "@/lib/api";
import { getTrustedDeviceToken, setMfaChallengeCookie, setSessionCookie } from "@/lib/session";
import { clientIpFromHeaders } from "@/lib/request";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await login(body, {
      ipAddress: clientIpFromHeaders(request.headers),
      rememberSession: body?.remember === true,
      trustedDeviceToken: await getTrustedDeviceToken(),
    });
    if (result.mfaRequired) {
      await setMfaChallengeCookie(result.challenge.rawToken, result.challenge.expiresAt);
      return json({ mfaRequired: true }, 202);
    }
    await setSessionCookie(result.session.rawToken, result.session.expiresAt);
    return json({ id: result.user.id, email: result.user.email, name: result.user.name, mfaRequired: false });
  } catch (error) {
    return errorResponse(error);
  }
}
