"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requestPasswordReset } from "@ax-finance/domain";
import { passwordResetPreviewPath, publicBaseUrl } from "@/lib/email";

export async function requestPasswordResetAction(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  let previewPath: string | undefined;

  try {
    const request = await requestPasswordReset(email, {
      baseUrl: publicBaseUrl(headers().get("origin") ?? undefined),
    });
    if (request) {
      previewPath = passwordResetPreviewPath(request.rawToken);
    }
  } catch (error) {
    console.error("Falha ao agendar redefinição de senha", error);
  }

  // Resposta idêntica para e-mail existente ou inexistente: evita enumeração.
  redirect(`/recuperar-senha?enviado=1${previewPath ? `&preview=${encodeURIComponent(previewPath)}` : ""}`);
}
