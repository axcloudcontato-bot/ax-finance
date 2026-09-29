"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { logOperationalError, requestPasswordReset } from "@ax-finance/domain";
import { passwordResetPreviewPath, publicBaseUrl } from "@/lib/email";

export async function requestPasswordResetAction(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  let previewPath: string | undefined;

  try {
    const requestHeaders = await headers();
    const request = await requestPasswordReset(email, {
      baseUrl: publicBaseUrl(requestHeaders.get("origin") ?? undefined),
    });
    if (request) {
      previewPath = passwordResetPreviewPath(request.rawToken);
    }
  } catch (error) {
    logOperationalError("web.password_reset_schedule_failed", error);
  }

  // Resposta idêntica para e-mail existente ou inexistente: evita enumeração.
  redirect(`/recuperar-senha?enviado=1${previewPath ? `&preview=${encodeURIComponent(previewPath)}` : ""}`);
}
