"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { issueEmailVerificationToken, registerUser } from "@ax-finance/domain";
import { ZodError } from "zod";
import { sendVerificationEmail } from "@/lib/email";

export async function registerAction(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const name = String(formData.get("name") ?? "");
  const password = String(formData.get("password") ?? "");
  const requestedReturnTo = String(formData.get("returnTo") ?? "");
  const returnTo = requestedReturnTo.startsWith("/convites/") ? requestedReturnTo : "";

  let user;
  try {
    user = await registerUser({ email, name, password }, { requireEmailVerification: true });
  } catch (error) {
    const message =
      error instanceof ZodError
        ? "Verifique o e-mail, nome e senha (mínimo 8 caracteres)."
        : error instanceof Error
          ? error.message
          : "Não foi possível concluir o cadastro.";
    redirect(`/registro?erro=${encodeURIComponent(message)}${returnTo ? `&retorno=${encodeURIComponent(returnTo)}` : ""}`);
  }

  let previewPath: string | undefined;
  try {
    const verification = await issueEmailVerificationToken(user.id);
    if (verification) {
      const delivery = await sendVerificationEmail({
        to: user.email,
        name: user.name,
        rawToken: verification.rawToken,
        fallbackOrigin: headers().get("origin") ?? undefined,
        returnTo,
      });
      previewPath = delivery.previewPath;
    }
  } catch (error) {
    console.error("Falha ao enviar verificação de e-mail", error);
  }

  redirect(`/login?cadastrado=1&verificacao=pendente${returnTo ? `&retorno=${encodeURIComponent(returnTo)}` : ""}${previewPath ? `&preview=${encodeURIComponent(previewPath)}` : ""}`);
}
