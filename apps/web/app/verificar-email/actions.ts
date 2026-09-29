"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { logOperationalError, requestEmailVerification } from "@ax-finance/domain";
import { publicBaseUrl, verificationPreviewPath } from "@/lib/email";

export async function resendVerificationAction(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  let previewPath: string | undefined;
  try {
    const requestHeaders = await headers();
    const request = await requestEmailVerification(email, {
      baseUrl: publicBaseUrl(requestHeaders.get("origin") ?? undefined),
    });
    if (request) {
      previewPath = verificationPreviewPath(request.rawToken);
    }
  } catch (error) {
    logOperationalError("web.email_verification_schedule_failed", error);
  }
  redirect(`/verificar-email?enviado=1${previewPath ? `&preview=${encodeURIComponent(previewPath)}` : ""}`);
}
