"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { EmailNotVerifiedError, login, TooManyLoginAttemptsError } from "@ax-finance/domain";
import { setMfaChallengeCookie, setSessionCookie } from "@/lib/session";
import { clientIpFromHeaders } from "@/lib/request";
import { safeAuthReturnTo } from "@/lib/auth-return";

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const remember = formData.get("remember") === "on";
  const requestedReturnTo = String(formData.get("returnTo") ?? "");
  const returnTo = safeAuthReturnTo(requestedReturnTo);
  let needsMfa = false;

  try {
    const requestHeaders = await headers();
    const result = await login(
      { email, password },
      { ipAddress: clientIpFromHeaders(requestHeaders), rememberSession: remember }
    );
    if (result.mfaRequired) {
      await setMfaChallengeCookie(result.challenge.rawToken, result.challenge.expiresAt);
      needsMfa = true;
    } else {
      // Sem "lembrar", o cookie dura só até o navegador ser fechado. A sessão
      // no banco continua revogável e expira normalmente em ambos os casos.
      await setSessionCookie(result.session.rawToken, remember ? result.session.expiresAt : undefined);
    }
  } catch (error) {
    const message = error instanceof TooManyLoginAttemptsError
      ? error.message
      : "E-mail ou senha inválidos.";
    // Mesma mensagem para qualquer motivo de falha — evita enumeração de e-mail.
    redirect(`/login?${error instanceof EmailNotVerifiedError ? "verificacao=pendente" : `erro=${encodeURIComponent(message)}`}${returnTo !== "/" ? `&retorno=${encodeURIComponent(returnTo)}` : ""}`);
  }

  if (needsMfa) redirect(`/mfa${returnTo !== "/" ? `?retorno=${encodeURIComponent(returnTo)}` : ""}`);
  redirect(returnTo === "/" ? "/painel" : returnTo);
}
