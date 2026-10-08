import { completeMfaChallenge } from "@ax-finance/domain";
import { errorResponse, json } from "@/lib/api";
import {
  clearMfaChallengeCookie,
  getMfaChallengeToken,
  setSessionCookie,
  setTrustedDeviceCookie,
} from "@/lib/session";
import { deviceLabelFromUserAgent } from "@/lib/request";

export async function POST(request: Request) {
  try {
    const token = await getMfaChallengeToken();
    if (!token) return json({ error: "MFA_CHALLENGE_INVALID", message: "Desafio inválido." }, 401);
    const body = await request.json();
    const result = await completeMfaChallenge(
      token,
      String(body?.code ?? ""),
      body?.trustDevice === true ? { trustDevice: { label: deviceLabelFromUserAgent(request.headers.get("user-agent")) } } : {}
    );
    await setSessionCookie(result.session.rawToken, result.rememberSession ? result.session.expiresAt : undefined);
    if (result.trustedDevice) await setTrustedDeviceCookie(result.trustedDevice.rawToken, result.trustedDevice.expiresAt);
    await clearMfaChallengeCookie();
    return json({ authenticated: true });
  } catch (error) {
    return errorResponse(error);
  }
}
