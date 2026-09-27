"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requestEmailVerification } from "@ax-finance/domain";
import { publicBaseUrl, verificationPreviewPath } from "@/lib/email";

export async function resendVerificationAction(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  let previewPath: string | undefined;
  try {
    const request = await requestEmailVerification(email, {
      baseUrl: publicBaseUrl(headers().get("origin") ?? undefined),
    });
    if (request) {
      previewPath = verificationPreviewPath(request.rawToken);
    }
  } catch (error) {
    console.error("Falha ao agendar verificação de e-mail", error);
  }
  redirect(`/verificar-email?enviado=1${previewPath ? `&preview=${encodeURIComponent(previewPath)}` : ""}`);
}
