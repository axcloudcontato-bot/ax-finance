export function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character]!);
}

/** Identificador da logo anexada inline pelo envio (ver `sendOutboxEmail`). */
export const LOGO_CID = "ax-finance-logo";

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
              <td class="ax-pad" style="padding:28px 40px 8px 40px;">
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
              <td class="ax-pad" style="padding:16px 40px 0 40px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:#8393b2;">
                ${note}
              </td>
            </tr>`
    : "";

  const fallbackLink = cta
    ? `<tr>
              <td class="ax-pad" style="padding:28px 40px 32px 40px;">
                <div style="height:1px;line-height:1px;font-size:1px;background-color:#dce4f0;">&nbsp;</div>
              </td>
            </tr>
            <tr>
              <td class="ax-pad" style="padding:0 40px 32px 40px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#8393b2;">
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
    <style>
      @media (max-width: 600px) {
        .ax-pad { padding-left: 20px !important; padding-right: 20px !important; }
        .ax-tile { max-width: 50% !important; }
        .ax-heading { font-size: 20px !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background-color:#f1f6fd;">
    <span style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;color:#f1f6fd;">${escapeHtml(preheader)}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f6fd;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:16px;border:1px solid #dce4f0;">
            <tr>
              <td class="ax-pad" style="padding:32px 40px 0 40px;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="width:40px;height:40px;vertical-align:middle;"><img src="cid:${LOGO_CID}" width="40" height="40" alt="" style="display:block;border:0;border-radius:10px;" /></td>
                    <td style="padding-left:12px;font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:800;color:#0c193d;">AX Finance</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="ax-pad ax-heading" style="padding:28px 40px 8px 40px;font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:800;color:#0c193d;">
                ${escapeHtml(heading)}
              </td>
            </tr>
            <tr>
              <td class="ax-pad" style="padding:0 40px 0 40px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#404b63;">
                ${bodyHtml}
              </td>
            </tr>
            ${button}
            ${noteRow}
            ${fallbackLink}
          </table>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
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

export type EmailTone = "neutral" | "accent" | "success" | "warning" | "danger";

/** Cores dos destaques: texto e fundo claro (os e-mails não têm tema escuro próprio). */
const TONE: Record<EmailTone, { text: string; background: string }> = {
  neutral: { text: "#404b63", background: "#f3f6fb" },
  accent: { text: "#2765ec", background: "#eaf1ff" },
  success: { text: "#0f7a55", background: "#e6f6ef" },
  warning: { text: "#a35a00", background: "#fff3e0" },
  danger: { text: "#b4235a", background: "#fdecf2" },
};

const FONT = "font-family:Arial,Helvetica,sans-serif;";
/** Largura útil do corpo (560 do cartão menos 40 de cada lado). */
const CONTENT_WIDTH = 480;

export type MetricTile = { label: string; value: string; hint?: string; tone?: EmailTone };

/**
 * Cartões de números lado a lado (até `perRow` por linha). Técnica "fluid hybrid": blocos inline-block
 * que se reorganizam sozinhos no celular (2 por linha) e uma tabela condicional para o Outlook desktop.
 * Os textos devem vir sem escapar: o escape é feito aqui.
 */
export function metricTiles(tiles: MetricTile[], perRow = Math.min(3, tiles.length)): string {
  const width = Math.floor(CONTENT_WIDTH / perRow);
  const cells = tiles.map((tile, index) => {
    const tone = TONE[tile.tone ?? "neutral"];
    const breakRow = index > 0 && index % perRow === 0 ? "<!--[if mso]></tr><tr><![endif]-->" : "";
    return `${breakRow}<!--[if mso]><td width="${width}" valign="top"><![endif]-->` +
      `<div class="ax-tile" style="display:inline-block;width:100%;max-width:${width}px;vertical-align:top;">` +
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:4px;">` +
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${tone.background};border-radius:12px;"><tr>` +
      `<td style="padding:14px 16px;${FONT}">` +
      `<div style="font-size:11px;line-height:1.4;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:#6b7891;">${escapeHtml(tile.label)}</div>` +
      `<div style="padding-top:4px;font-size:19px;line-height:1.25;font-weight:800;color:${tone.text};">${escapeHtml(tile.value)}</div>` +
      (tile.hint ? `<div style="padding-top:2px;font-size:12px;line-height:1.4;color:#6b7891;">${escapeHtml(tile.hint)}</div>` : "") +
      `</td></tr></table></td></tr></table></div><!--[if mso]></td><![endif]-->`;
  }).join("");
  return `<div style="margin:4px -4px 8px -4px;font-size:0;line-height:0;">` +
    `<!--[if mso]><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><![endif]-->${cells}<!--[if mso]></tr></table><![endif]-->` +
    `</div>`;
}

/** Título de uma seção do corpo, com contagem opcional. */
export function sectionTitle(text: string, tone: EmailTone = "neutral", count?: number): string {
  const color = tone === "neutral" ? "#6b7891" : TONE[tone].text;
  return `<p style="margin:22px 0 8px 0;${FONT}font-size:12px;line-height:1.4;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${color};">` +
    `${escapeHtml(text)}${count === undefined ? "" : ` · ${count}`}</p>`;
}

export type ItemRow = {
  href: string;
  badge: { label: string; tone: EmailTone };
  title: string;
  /** Linha de apoio (ex.: cliente e vencimento). */
  meta: { text: string; tone?: EmailTone }[];
  amount?: string;
};

/** Lista de itens em cartão (ex.: títulos do dia): selo, descrição com link, detalhes e valor à direita. */
export function itemList(rows: ItemRow[]): string {
  const body = rows.map((row, index) => {
    const border = index === 0 ? "" : "border-top:1px solid #e8edf5;";
    const badge = TONE[row.badge.tone];
    const meta = row.meta
      .map((part) => `<span style="color:${part.tone ? TONE[part.tone].text : "#6b7891"};">${escapeHtml(part.text)}</span>`)
      .join(`<span style="color:#b3bdd0;"> · </span>`);
    return `<tr>` +
      `<td style="${border}padding:12px 14px;${FONT}vertical-align:top;">` +
      `<span style="display:inline-block;padding:2px 8px;border-radius:999px;background-color:${badge.background};color:${badge.text};font-size:11px;line-height:1.5;font-weight:700;">${escapeHtml(row.badge.label)}</span>` +
      `<div style="padding-top:5px;font-size:14px;line-height:1.4;font-weight:700;"><a href="${escapeHtml(row.href)}" style="color:#0c193d;text-decoration:none;">${escapeHtml(row.title)}</a></div>` +
      (meta ? `<div style="padding-top:2px;font-size:12px;line-height:1.5;">${meta}</div>` : "") +
      `</td>` +
      `<td align="right" style="${border}padding:12px 14px;${FONT}vertical-align:top;white-space:nowrap;font-size:14px;line-height:1.4;font-weight:800;color:#0c193d;">${row.amount ? escapeHtml(row.amount) : ""}</td>` +
      `</tr>`;
  }).join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #dce4f0;border-radius:12px;border-collapse:separate;">${body}</table>`;
}
