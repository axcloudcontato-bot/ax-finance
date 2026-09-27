"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { registerUser } from "@ax-finance/domain";
import { ZodError } from "zod";
import { publicBaseUrl, verificationPreviewPath } from "@/lib/email";

export async function registerAction(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const name = String(formData.get("name") ?? "");
  const password = String(formData.get("password") ?? "");
  const requestedReturnTo = String(formData.get("returnTo") ?? "");
  const returnTo = requestedReturnTo.startsWith("/convites/") ? requestedReturnTo : "";

  let user;
  try {
    user = await registerUser(
      { email, name, password },
      {
        requireEmailVerification: true,
        verificationDelivery: {
          baseUrl: publicBaseUrl(headers().get("origin") ?? undefined),
          returnTo: returnTo || undefined,
        },
      }
    );
  } catch (error) {
    const message =
      error instanceof ZodError
        ? "Verifique o e-mail, nome e senha (mínimo 8 caracteres)."
        : error instanceof Error
          ? error.message
          : "Não foi possível concluir o cadastro.";
    redirect(`/registro?erro=${encodeURIComponent(message)}${returnTo ? `&retorno=${encodeURIComponent(returnTo)}` : ""}`);
  }

  const previewPath = user.verification
    ? verificationPreviewPath(user.verification.rawToken, returnTo || undefined)
    : undefined;

  redirect(`/login?cadastrado=1&verificacao=pendente${returnTo ? `&retorno=${encodeURIComponent(returnTo)}` : ""}${previewPath ? `&preview=${encodeURIComponent(previewPath)}` : ""}`);
}
