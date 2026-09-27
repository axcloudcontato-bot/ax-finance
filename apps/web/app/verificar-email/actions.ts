"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requestEmailVerification } from "@ax-finance/domain";
import { sendVerificationEmail } from "@/lib/email";

export async function resendVerificationAction(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  let previewPath: string | undefined;
  try {
    const request = await requestEmailVerification(email);
    if (request) {
      const delivery = await sendVerificationEmail({
        to: request.user.email,
        name: request.user.name,
        rawToken: request.rawToken,
        fallbackOrigin: headers().get("origin") ?? undefined,
      });
      previewPath = delivery.previewPath;
    }
  } catch (error) {
    console.error("Falha ao reenviar verificação de e-mail", error);
  }
  redirect(`/verificar-email?enviado=1${previewPath ? `&preview=${encodeURIComponent(previewPath)}` : ""}`);
}
