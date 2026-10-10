"use client";

/** Atalhos dos provedores mais comuns: preenchem servidor, porta e segurança do formulário. */
const PRESETS: Record<string, { host: string; port: number; security: "starttls" | "ssl"; hint: string }> = {
  gmail: { host: "smtp.gmail.com", port: 587, security: "starttls", hint: "Gmail/Google Workspace: use uma senha de app (com verificação em duas etapas ligada)." },
  outlook: { host: "smtp.office365.com", port: 587, security: "starttls", hint: "Microsoft 365/Outlook: o SMTP autenticado precisa estar liberado na conta." },
  ses: { host: "email-smtp.us-east-1.amazonaws.com", port: 587, security: "starttls", hint: "Amazon SES: troque a região do servidor se for outra; usuário e senha são as credenciais SMTP do SES." },
  sendgrid: { host: "smtp.sendgrid.net", port: 587, security: "starttls", hint: "SendGrid: usuário é a palavra apikey e a senha é a chave da API." },
  brevo: { host: "smtp-relay.brevo.com", port: 587, security: "starttls", hint: "Brevo: usuário e senha SMTP ficam em SMTP & API no painel da Brevo." },
  locaweb: { host: "email-ssl.com.br", port: 465, security: "ssl", hint: "Locaweb: use o e-mail completo como usuário." },
  hostinger: { host: "smtp.hostinger.com", port: 465, security: "ssl", hint: "Hostinger: use o e-mail completo como usuário." },
};

export function SmtpProviderPreset({ formId }: { formId: string }) {
  function apply(key: string) {
    const preset = PRESETS[key];
    const form = document.getElementById(formId) as HTMLFormElement | null;
    const hint = document.getElementById(`${formId}-hint`);
    if (!preset || !form) return;
    (form.elements.namedItem("host") as HTMLInputElement).value = preset.host;
    (form.elements.namedItem("port") as HTMLInputElement).value = String(preset.port);
    (form.elements.namedItem("security") as HTMLSelectElement).value = preset.security;
    if (hint) hint.textContent = preset.hint;
  }

  return (
    <select aria-label="Preencher com um provedor" defaultValue="" onChange={(event) => apply(event.target.value)}>
      <option value="">Preencher com um provedor…</option>
      <option value="gmail">Gmail / Google Workspace</option>
      <option value="outlook">Microsoft 365 / Outlook</option>
      <option value="ses">Amazon SES</option>
      <option value="sendgrid">SendGrid</option>
      <option value="brevo">Brevo</option>
      <option value="locaweb">Locaweb</option>
      <option value="hostinger">Hostinger</option>
    </select>
  );
}
