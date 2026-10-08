"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { completeMfaChallenge, MfaChallengeInvalidError } from "@ax-finance/domain";
import {
  clearMfaChallengeCookie,
  getMfaChallengeToken,
  setSessionCookie,
  setTrustedDeviceCookie,
} from "@/lib/session";
import { deviceLabelFromUserAgent } from "@/lib/request";
import { safeAuthReturnTo } from "@/lib/auth-return";
import { actionErrorMessage } from "@/lib/action-errors";

export interface MfaLoginState {
  error?: string;
}

export async function completeMfaAction(
  _previousState: MfaLoginState,
  formData: FormData
): Promise<MfaLoginState> {
  const challengeToken = await getMfaChallengeToken();
  if (!challengeToken) return { error: "O acesso expirou. Entre novamente." };
  const requestedReturnTo = String(formData.get("returnTo") ?? "");
  const returnTo = safeAuthReturnTo(requestedReturnTo);

  try {
    const result = await completeMfaChallenge(
      challengeToken,
      String(formData.get("code") ?? ""),
      formData.get("trustDevice") === "on"
        ? { trustDevice: { label: deviceLabelFromUserAgent((await headers()).get("user-agent")) } }
        : {}
    );
    await setSessionCookie(
      result.session.rawToken,
      result.rememberSession ? result.session.expiresAt : undefined
    );
    if (result.trustedDevice) await setTrustedDeviceCookie(result.trustedDevice.rawToken, result.trustedDevice.expiresAt);
    await clearMfaChallengeCookie();
  } catch (error) {
    if (error instanceof MfaChallengeInvalidError) await clearMfaChallengeCookie();
    return { error: actionErrorMessage(error, "Não foi possível validar o código.") };
  }

  redirect(returnTo === "/" ? "/painel" : returnTo);
}
