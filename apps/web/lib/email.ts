export function publicBaseUrl(fallbackOrigin?: string): string {
  const configured = process.env.APP_BASE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  if (process.env.NODE_ENV !== "production") {
    return (fallbackOrigin || "http://localhost:3000").replace(/\/$/, "");
  }
  throw new Error("APP_BASE_URL não configurada para envio de e-mail.");
}

export function emailPreviewEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.EMAIL_PREVIEW !== "false";
}

export function verificationPreviewPath(rawToken: string, returnTo?: string): string | undefined {
  if (!emailPreviewEnabled()) return undefined;
  return `/verificar-email/${rawToken}${returnTo ? `?retorno=${encodeURIComponent(returnTo)}` : ""}`;
}

export function passwordResetPreviewPath(rawToken: string): string | undefined {
  return emailPreviewEnabled() ? `/redefinir-senha/${rawToken}` : undefined;
}
