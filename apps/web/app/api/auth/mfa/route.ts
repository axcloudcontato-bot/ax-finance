import { completeMfaChallenge } from "@ax-finance/domain";
import { errorResponse, json } from "@/lib/api";
import {
  clearMfaChallengeCookie,
  getMfaChallengeToken,
  setSessionCookie,
} from "@/lib/session";

export async function POST(request: Request) {
  try {
    const token = getMfaChallengeToken();
    if (!token) return json({ error: "MFA_CHALLENGE_INVALID", message: "Desafio inválido." }, 401);
    const body = await request.json();
    const result = await completeMfaChallenge(token, String(body?.code ?? ""));
    setSessionCookie(result.session.rawToken, result.rememberSession ? result.session.expiresAt : undefined);
    clearMfaChallengeCookie();
    return json({ authenticated: true });
  } catch (error) {
    return errorResponse(error);
  }
}
