"use server";

import { redirect } from "next/navigation";
import { completeMfaChallenge, MfaChallengeInvalidError } from "@ax-finance/domain";
import {
  clearMfaChallengeCookie,
  getMfaChallengeToken,
  setSessionCookie,
} from "@/lib/session";

export interface MfaLoginState {
  error?: string;
}

export async function completeMfaAction(
  _previousState: MfaLoginState,
  formData: FormData
): Promise<MfaLoginState> {
  const challengeToken = getMfaChallengeToken();
  if (!challengeToken) return { error: "O acesso expirou. Entre novamente." };
  const requestedReturnTo = String(formData.get("returnTo") ?? "");
  const returnTo = requestedReturnTo.startsWith("/convites/") ? requestedReturnTo : "/";

  try {
    const result = await completeMfaChallenge(
      challengeToken,
      String(formData.get("code") ?? "")
    );
    setSessionCookie(
      result.session.rawToken,
      result.rememberSession ? result.session.expiresAt : undefined
    );
    clearMfaChallengeCookie();
  } catch (error) {
    if (error instanceof MfaChallengeInvalidError) clearMfaChallengeCookie();
    return { error: error instanceof Error ? error.message : "Não foi possível validar o código." };
  }

  redirect(returnTo);
}
