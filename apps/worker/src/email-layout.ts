export function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character]!);
}

export type EmailLayoutInput = {
  preheader: string;
  heading: string;
  /** HTML já escapado pelo chamador. */
  bodyHtml: string;
  cta?: { url: string; label: string };
  /** Texto curto abaixo do botão (já escapado). */
  note?: string;
  /** Rodapé; o padrão serve para e-mails de notificação. */
  footerNote?: string;
};

const DEFAULT_FOOTER = "Você recebeu este e-mail porque tem acesso ao AX Finance.";

/**
 * Layout base dos e-mails transacionais: tabelas com estilo inline (não
 * flex/grid), porque é o que sobrevive em Outlook desktop e Gmail. O botão
 * usa VML como fallback para o Outlook.
 */
export function renderEmailLayout(input: EmailLayoutInput): string {
  const { preheader, heading, bodyHtml, cta, note, footerNote = DEFAULT_FOOTER } = input;
  const safeUrl = cta ? escapeHtml(cta.url) : "";
  const safeLabel = cta ? escapeHtml(cta.label) : "";

  const button = cta
    ? `<tr>
              <td style="padding:28px 40px 8px 40px;">
                <!--[if mso]>
                <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${safeUrl}" style="height:48px;v-text-anchor:middle;width:240px;" arcsize="14%" strokecolor="#3478ff" fillcolor="#3478ff">
                <w:anchorlock/>
                <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;">${safeLabel}</center>
                </v:roundrect>
                <![endif]-->
                <!--[if !mso]><!-->
                <a href="${safeUrl}" style="background-color:#3478ff;border-radius:10px;color:#ffffff;display:inline-block;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;line-height:48px;text-align:center;text-decoration:none;width:240px;">${safeLabel}</a>
                <!--<![endif]-->
              </td>
            </tr>`
    : "";

  const noteRow = note
    ? `<tr>
              <td style="padding:16px 40px 0 40px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:#8393b2;">
                ${note}
              </td>
            </tr>`
    : "";

  const fallbackLink = cta
    ? `<tr>
              <td style="padding:28px 40px 32px 40px;">
                <div style="height:1px;line-height:1px;font-size:1px;background-color:#dce4f0;">&nbsp;</div>
              </td>
            </tr>
            <tr>
              <td style="padding:0 40px 32px 40px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#8393b2;">
                Se o botão acima não funcionar, copie e cole este link no navegador:<br />
                <a href="${safeUrl}" style="color:#2765ec;word-break:break-all;">${safeUrl}</a>
              </td>
            </tr>`
    : `<tr><td style="padding:0 0 32px 0;font-size:1px;line-height:1px;">&nbsp;</td></tr>`;

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
    <span style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;color:#f1f6fd;">${escapeHtml(preheader)}</span>
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
                ${escapeHtml(heading)}
              </td>
            </tr>
            <tr>
              <td style="padding:0 40px 0 40px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#404b63;">
                ${bodyHtml}
              </td>
            </tr>
            ${button}
            ${noteRow}
            ${fallbackLink}
          </table>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
            <tr>
              <td style="padding:20px 24px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#8393b2;">
                AX Finance · Gestão financeira para empresas de serviço<br />
                ${escapeHtml(footerNote)}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/** Parágrafo padrão do corpo, com margens consistentes. */
export function paragraph(html: string, last = false): string {
  return `<p style="margin:0 0 ${last ? "0" : "12px"} 0;">${html}</p>`;
}
