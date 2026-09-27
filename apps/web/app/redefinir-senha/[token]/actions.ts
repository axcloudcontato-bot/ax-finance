"use server";

import { redirect } from "next/navigation";
import { resetPassword } from "@ax-finance/domain";

export async function resetPasswordAction(token: string, formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("passwordConfirmation") ?? "");
  if (password !== confirmation) {
    redirect(`/redefinir-senha/${token}?erro=${encodeURIComponent("As senhas não coincidem.")}`);
  }

  try {
    await resetPassword(token, password);
  } catch (error) {
    redirect(`/redefinir-senha/${token}?erro=${encodeURIComponent(error instanceof Error ? error.message : "Não foi possível redefinir a senha.")}`);
  }
  redirect("/login?senhaRedefinida=1");
}
