"use server";

import { redirect } from "next/navigation";
import { login } from "@ax-finance/domain";
import { setSessionCookie } from "@/lib/session";

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  try {
    const { session } = await login({ email, password });
    setSessionCookie(session.rawToken, session.expiresAt);
  } catch {
    // Mesma mensagem para qualquer motivo de falha — evita enumeração de e-mail.
    redirect(`/login?erro=${encodeURIComponent("E-mail ou senha inválidos.")}`);
  }

  redirect("/");
}
