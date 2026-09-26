"use server";

import { redirect } from "next/navigation";
import { registerUser } from "@ax-finance/domain";
import { ZodError } from "zod";

export async function registerAction(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const name = String(formData.get("name") ?? "");
  const password = String(formData.get("password") ?? "");

  try {
    await registerUser({ email, name, password });
  } catch (error) {
    const message =
      error instanceof ZodError
        ? "Verifique o e-mail, nome e senha (mínimo 8 caracteres)."
        : error instanceof Error
          ? error.message
          : "Não foi possível concluir o cadastro.";
    redirect(`/registro?erro=${encodeURIComponent(message)}`);
  }

  redirect("/login?cadastrado=1");
}
