"use server";

import { redirect } from "next/navigation";
import { verifyEmail } from "@ax-finance/domain";

export async function verifyEmailAction(token: string, returnTo: string | undefined) {
  try {
    await verifyEmail(token);
  } catch (error) {
    redirect(`/verificar-email/${token}?erro=${encodeURIComponent(error instanceof Error ? error.message : "Não foi possível confirmar o e-mail.")}`);
  }
  const safeReturnTo = returnTo?.startsWith("/convites/") ? returnTo : undefined;
  redirect(`/login?emailVerificado=1${safeReturnTo ? `&retorno=${encodeURIComponent(safeReturnTo)}` : ""}`);
}
