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

/**
 * Layout base pra todo e-mail transacional: tabelas (não flex/grid) e estilo
 * inline em tudo, porque é o que sobrevive em Outlook desktop/Gmail — CSS em
 * <style> ou moderno (flex, grid, border no <a>) é removido ou ignorado por
 * boa parte dos clientes de e-mail.
 */
function renderEmailLayout(input: {
  preheader: string;
  heading: string;
  bodyHtml: string;
  ctaUrl: string;
  ctaLabel: string;
  note: string;
}): string {
  const { preheader, heading, bodyHtml, ctaUrl, ctaLabel, note } = input;
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>AX Finance</title>
    <!--[if mso]>
    <noscript>
      <xml>
        <o:OfficeDocumentSettings>
          <o:PixelsPerInch>96</o:PixelsPerInch>
        </o:OfficeDocumentSettings>
      </xml>
    </noscript>
    <![endif]-->
  </head>
  <body style="margin:0;padding:0;background-color:#f1f6fd;">
    <span style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;color:#f1f6fd;">${preheader}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f6fd;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:16px;border:1px solid #dce4f0;">
            <tr>
              <td style="padding:32px 40px 0 40px;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="width:36px;height:36px;background-color:#3478ff;border-radius:10px;text-align:center;vertical-align:middle;font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:700;color:#ffffff;">A</td>
                    <td style="padding-left:12px;font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:800;color:#0c193d;">AX Finance</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 40px 8px 40px;font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:800;color:#0c193d;">
                ${heading}
              </td>
            </tr>
            <tr>
              <td style="padding:0 40px 0 40px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#404b63;">
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:28px 40px 8px 40px;">
                <!--[if mso]>
                <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${ctaUrl}" style="height:48px;v-text-anchor:middle;width:240px;" arcsize="14%" strokecolor="#3478ff" fillcolor="#3478ff">
                <w:anchorlock/>
                <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;">${ctaLabel}</center>
                </v:roundrect>
                <![endif]-->
                <!--[if !mso]><!-->
                <a href="${ctaUrl}" style="background-color:#3478ff;border-radius:10px;color:#ffffff;display:inline-block;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;line-height:48px;text-align:center;text-decoration:none;width:240px;">${ctaLabel}</a>
                <!--<![endif]-->
              </td>
            </tr>
            <tr>
              <td style="padding:16px 40px 0 40px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:#8393b2;">
                ${note}
              </td>
            </tr>
            <tr>
              <td style="padding:28px 40px 32px 40px;">
                <div style="height:1px;line-height:1px;font-size:1px;background-color:#dce4f0;">&nbsp;</div>
              </td>
            </tr>
            <tr>
              <td style="padding:0 40px 32px 40px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#8393b2;">
                Se o botão acima não funcionar, copie e cole este link no navegador:<br />
                <a href="${ctaUrl}" style="color:#2765ec;word-break:break-all;">${ctaUrl}</a>
              </td>
            </tr>
          </table>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
            <tr>
              <td style="padding:20px 24px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#8393b2;">
                AX Finance · Gestão financeira para empresas de serviço<br />
                Você recebeu este e-mail porque uma ação foi solicitada com este endereço. Se não foi você, ignore esta mensagem.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
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
    html: renderEmailLayout({
      preheader: "Confirme seu e-mail para ativar o acesso ao AX Finance.",
      heading: "Confirme seu e-mail",
      bodyHtml: `<p style="margin:0 0 12px 0;">Olá, ${safeName}.</p><p style="margin:0;">Confirme seu e-mail para ativar o acesso ao AX Finance:</p>`,
      ctaUrl: safeUrl,
      ctaLabel: "Confirmar e-mail",
      note: "O link expira em 24 horas.",
    }),
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
    html: renderEmailLayout({
      preheader: "Redefina sua senha do AX Finance. O link expira em 1 hora.",
      heading: "Redefinir senha",
      bodyHtml: `<p style="margin:0 0 12px 0;">Olá, ${safeName}.</p><p style="margin:0;">Recebemos uma solicitação para redefinir a senha da sua conta:</p>`,
      ctaUrl: safeUrl,
      ctaLabel: "Redefinir senha",
      note: "O link expira em 1 hora. Se não foi você quem solicitou, ignore esta mensagem — sua senha continua a mesma.",
    }),
  });
  return { delivered, previewPath: emailPreviewEnabled() ? path : undefined };
}
