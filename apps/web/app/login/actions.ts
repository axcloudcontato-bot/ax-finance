"use server";

import { redirect } from "next/navigation";
import { login } from "@ax-finance/domain";
import { setSessionCookie } from "@/lib/session";

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const remember = formData.get("remember") === "on";

  try {
    const { session } = await login({ email, password });
    // Sem "lembrar", o cookie dura só até o navegador ser fechado. A sessão
    // no banco continua revogável e expira normalmente em ambos os casos.
    setSessionCookie(session.rawToken, remember ? session.expiresAt : undefined);
  } catch {
    // Mesma mensagem para qualquer motivo de falha — evita enumeração de e-mail.
    redirect(`/login?erro=${encodeURIComponent("E-mail ou senha inválidos.")}`);
  }

  redirect("/");
}
