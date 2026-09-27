import nodemailer from "nodemailer";

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character]!);
}

function publicBaseUrl(fallbackOrigin?: string): string {
  const configured = process.env.APP_BASE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  if (process.env.NODE_ENV !== "production") return (fallbackOrigin || "http://localhost:3000").replace(/\/$/, "");
  throw new Error("APP_BASE_URL não configurada para envio de e-mail.");
}

export function emailPreviewEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.EMAIL_PREVIEW !== "false";
}

async function sendMail(message: { to: string; subject: string; text: string; html: string }) {
  const host = process.env.SMTP_HOST?.trim();
  const from = process.env.SMTP_FROM?.trim();
  if (!host || !from) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SMTP_HOST/SMTP_FROM não configurados.");
    }
    return false;
  }

  const port = Number(process.env.SMTP_PORT || "587");
  const user = process.env.SMTP_USER?.trim();
  const password = process.env.SMTP_PASSWORD;
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === "true" || port === 465,
    auth: user && password ? { user, pass: password } : undefined,
  });
  await transporter.sendMail({ from, ...message });
  return true;
}

export async function sendVerificationEmail(input: {
  to: string;
  name: string;
  rawToken: string;
  fallbackOrigin?: string;
  returnTo?: string;
}) {
  const path = `/verificar-email/${input.rawToken}${input.returnTo ? `?retorno=${encodeURIComponent(input.returnTo)}` : ""}`;
  const url = `${publicBaseUrl(input.fallbackOrigin)}${path}`;
  const safeName = escapeHtml(input.name);
  const safeUrl = escapeHtml(url);
  const delivered = await sendMail({
    to: input.to,
    subject: "Confirme seu e-mail no AX Finance",
    text: `Olá, ${input.name}. Confirme seu e-mail acessando: ${url}\nO link expira em 24 horas.`,
    html: `<p>Olá, ${safeName}.</p><p>Confirme seu e-mail para ativar o acesso ao AX Finance:</p><p><a href="${safeUrl}">Confirmar e-mail</a></p><p>O link expira em 24 horas.</p>`,
  });
  return { delivered, previewPath: emailPreviewEnabled() ? path : undefined };
}

export async function sendPasswordResetEmail(input: {
  to: string;
  name: string;
  rawToken: string;
  fallbackOrigin?: string;
}) {
  const path = `/redefinir-senha/${input.rawToken}`;
  const url = `${publicBaseUrl(input.fallbackOrigin)}${path}`;
  const safeName = escapeHtml(input.name);
  const safeUrl = escapeHtml(url);
  const delivered = await sendMail({
    to: input.to,
    subject: "Redefinição de senha do AX Finance",
    text: `Olá, ${input.name}. Redefina sua senha acessando: ${url}\nO link expira em 1 hora.`,
    html: `<p>Olá, ${safeName}.</p><p>Recebemos uma solicitação para redefinir sua senha:</p><p><a href="${safeUrl}">Redefinir senha</a></p><p>O link expira em 1 hora. Se não foi você, ignore esta mensagem.</p>`,
  });
  return { delivered, previewPath: emailPreviewEnabled() ? path : undefined };
}
