import nodemailer from "nodemailer";
import type { OutboxEvent } from "@ax-finance/db";
import { structuredLog } from "@ax-finance/domain";
import {
  decodeAccessChangedPayload,
  decodeBillingNoticePayload,
  decodeCompanyInvitationPayload,
  decodeDueDateSummaryPayload,
  decodeImportFailedPayload,
  decodeOutboxEmailPayload,
  decodeWeeklySummaryPayload,
} from "@ax-finance/domain";
import { escapeHtml, paragraph, renderEmailLayout } from "./email-layout";

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Proprietário",
  FINANCE_ADMIN: "Administrador financeiro",
  OPERATOR: "Operador",
  ACCOUNTANT: "Contador",
  VIEWER: "Consulta",
};

const ACTION_FOOTER =
  "Você recebeu este e-mail porque uma ação foi solicitada com este endereço. Se não foi você, ignore esta mensagem.";

function applicationBaseUrl() {
  const configured = process.env.APP_BASE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  if (process.env.NODE_ENV === "production") throw new Error("APP_BASE_URL não configurada no worker.");
  return "http://localhost:3000";
}

function transport() {
  const host = process.env.SMTP_HOST?.trim();
  const from = process.env.SMTP_FROM?.trim();
  if (!host || !from) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SMTP_HOST/SMTP_FROM não configurados.");
    }
    return null;
  }
  const port = Number(process.env.SMTP_PORT || "587");
  const user = process.env.SMTP_USER?.trim();
  const password = process.env.SMTP_PASSWORD;
  return {
    from,
    client: nodemailer.createTransport({
      host,
      port,
      secure: process.env.SMTP_SECURE === "true" || port === 465,
      auth: user && password ? { user, pass: password } : undefined,
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: 30_000,
    }),
  };
}

export type RenderedEmail = { recipient: string; subject: string; text: string; html: string };

export function renderOutboxEmail(event: OutboxEvent): RenderedEmail {
  if (event.type === "EMAIL_VERIFICATION") {
    const payload = decodeOutboxEmailPayload(event);
    const path = `/verificar-email/${payload.rawToken}${payload.returnTo ? `?retorno=${encodeURIComponent(payload.returnTo)}` : ""}`;
    const url = `${payload.baseUrl}${path}`;
    return {
      recipient: payload.to,
      subject: "Confirme seu e-mail no AX Finance",
      text: `Olá, ${payload.name}. Confirme seu e-mail acessando: ${url}\nO link expira em 24 horas.`,
      html: renderEmailLayout({
        preheader: "Confirme seu e-mail para ativar o acesso ao AX Finance.",
        heading: "Confirme seu e-mail",
        bodyHtml: paragraph(`Olá, ${escapeHtml(payload.name)}.`) + paragraph("Confirme seu e-mail para ativar o acesso ao AX Finance:", true),
        cta: { url, label: "Confirmar e-mail" },
        note: "O link expira em 24 horas.",
        footerNote: ACTION_FOOTER,
      }),
    };
  }

  if (event.type === "PASSWORD_RESET") {
    const payload = decodeOutboxEmailPayload(event);
    const url = `${payload.baseUrl}/redefinir-senha/${payload.rawToken}`;
    return {
      recipient: payload.to,
      subject: "Redefinição de senha do AX Finance",
      text: `Olá, ${payload.name}. Redefina sua senha acessando: ${url}\nO link expira em 1 hora.`,
      html: renderEmailLayout({
        preheader: "Redefina sua senha do AX Finance. O link expira em 1 hora.",
        heading: "Redefinir senha",
        bodyHtml: paragraph(`Olá, ${escapeHtml(payload.name)}.`) + paragraph("Recebemos uma solicitação para redefinir a senha da sua conta:", true),
        cta: { url, label: "Redefinir senha" },
        note: "O link expira em 1 hora. Se não foi você quem solicitou, ignore esta mensagem — sua senha continua a mesma.",
        footerNote: ACTION_FOOTER,
      }),
    };
  }

  if (event.type === "DUE_DATE_SUMMARY") {
    const payload = decodeDueDateSummaryPayload(event);
    const rows = payload.items.map((item) => {
      const label = item.type === "RECEIVABLE" ? "Entrada" : "Saída";
      return `${label}: ${item.description} — ${item.overdue ? "vencido em" : "vence em"} ${item.dueDate}`;
    });
    const htmlRows = payload.items.map((item) => {
      const label = item.type === "RECEIVABLE" ? "Entrada" : "Saída";
      const url = `${payload.baseUrl}${item.href}`;
      return `<li style="margin:0 0 8px 0;"><a href="${escapeHtml(url)}" style="color:#2765ec;">${escapeHtml(label)}: ${escapeHtml(item.description)}</a> — ${item.overdue ? "vencido em" : "vence em"} ${escapeHtml(item.dueDate)}</li>`;
    }).join("");
    return {
      recipient: payload.to,
      subject: `Títulos vencidos e do dia — ${payload.companyName}`,
      text: `Olá, ${payload.name}.\n\n${rows.join("\n")}\n\nAcesse: ${payload.baseUrl}`,
      html: renderEmailLayout({
        preheader: `Títulos que precisam de atenção em ${payload.companyName}.`,
        heading: "Títulos que precisam de atenção",
        bodyHtml:
          paragraph(`Olá, ${escapeHtml(payload.name)}.`) +
          paragraph(`Estes títulos precisam de atenção em <strong>${escapeHtml(payload.companyName)}</strong>:`) +
          `<ul style="margin:0;padding:0 0 0 20px;">${htmlRows}</ul>`,
        cta: { url: payload.baseUrl, label: "Abrir o AX Finance" },
      }),
    };
  }

  if (event.type === "WEEKLY_SUMMARY") {
    const payload = decodeWeeklySummaryPayload(event);
    const money = (cents: string) => new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(Number(BigInt(cents)) / 100);
    const url = `${payload.baseUrl}/relatorios/fluxo-de-caixa`;
    return {
      recipient: payload.to,
      subject: `Resumo financeiro semanal — ${payload.companyName}`,
      text: `Olá, ${payload.name}.\nEntradas em aberto: ${money(payload.receivableOpenCents)}\nSaídas em aberto: ${money(payload.payableOpenCents)}\nVencidos: ${payload.overdueCount}\nPróximos 7 dias: ${payload.dueNext7Count}\n${url}`,
      html: renderEmailLayout({
        preheader: `Resumo semanal de ${payload.companyName}.`,
        heading: "Resumo financeiro semanal",
        bodyHtml:
          paragraph(`Olá, ${escapeHtml(payload.name)}.`) +
          paragraph(`Resumo semanal de <strong>${escapeHtml(payload.companyName)}</strong>:`) +
          `<ul style="margin:0;padding:0 0 0 20px;">` +
          `<li style="margin:0 0 6px 0;">Entradas em aberto: ${escapeHtml(money(payload.receivableOpenCents))}</li>` +
          `<li style="margin:0 0 6px 0;">Saídas em aberto: ${escapeHtml(money(payload.payableOpenCents))}</li>` +
          `<li style="margin:0 0 6px 0;">Vencidos: ${payload.overdueCount}</li>` +
          `<li style="margin:0;">Próximos 7 dias: ${payload.dueNext7Count}</li></ul>`,
        cta: { url, label: "Abrir relatórios" },
      }),
    };
  }

  if (event.type === "COMPANY_INVITATION") {
    const payload = decodeCompanyInvitationPayload(event);
    const url = `${applicationBaseUrl()}/convites/${payload.rawToken}`;
    const role = ROLE_LABEL[payload.role] || payload.role;
    const expires = new Date(payload.expiresAt).toLocaleDateString("pt-BR", { timeZone: "UTC" });
    return {
      recipient: payload.to,
      subject: `Convite para acessar ${payload.companyName}`,
      text: `${payload.invitedByName} convidou você para acessar ${payload.companyName} como ${role}.\nAceite o convite: ${url}\nO convite expira em ${expires}.`,
      html: renderEmailLayout({
        preheader: `${payload.invitedByName} convidou você para acessar ${payload.companyName}.`,
        heading: "Você recebeu um convite",
        bodyHtml: paragraph(`<strong>${escapeHtml(payload.invitedByName)}</strong> convidou você para acessar <strong>${escapeHtml(payload.companyName)}</strong> como ${escapeHtml(role)}.`, true),
        cta: { url, label: "Aceitar convite" },
        note: `O convite expira em ${escapeHtml(expires)}.`,
        footerNote: ACTION_FOOTER,
      }),
    };
  }

  if (event.type === "ACCESS_CHANGED") {
    const payload = decodeAccessChangedPayload(event);
    const role = payload.role ? ROLE_LABEL[payload.role] || payload.role : undefined;
    const messages = {
      ROLE_CHANGED: `Seu papel em ${payload.companyName} foi alterado para ${role}.`,
      ACCESS_REVOKED: `Seu acesso a ${payload.companyName} foi revogado.`,
      INVITATION_ACCEPTED: `${payload.targetName || "O usuário convidado"} aceitou o convite para acessar ${payload.companyName}.`,
      INVITATION_REVOKED: `O convite para acessar ${payload.companyName} foi revogado.`,
      OWNERSHIP_TRANSFERRED: payload.role === "OWNER"
        ? `A propriedade de ${payload.companyName} foi transferida para você.`
        : `A propriedade de ${payload.companyName} foi transferida para ${payload.targetName || "outro usuário"}. Seu papel agora é ${role}.`,
    } as const;
    const message = messages[payload.kind];
    const accepted = payload.kind === "INVITATION_ACCEPTED";
    return {
      recipient: payload.to,
      subject: accepted ? `Convite aceito — ${payload.companyName}` : `Alteração de acesso — ${payload.companyName}`,
      text: `${message}${payload.actorName ? `\nAlteração realizada por ${payload.actorName}.` : ""}`,
      html: renderEmailLayout({
        preheader: message,
        heading: accepted ? "Convite aceito" : "Alteração de acesso",
        bodyHtml:
          paragraph(escapeHtml(message), !payload.actorName) +
          (payload.actorName ? paragraph(`Alteração realizada por ${escapeHtml(payload.actorName)}.`, true) : ""),
        footerNote: `Você recebeu este e-mail porque tem ou tinha acesso a ${payload.companyName} no AX Finance.`,
      }),
    };
  }

  if (event.type === "IMPORT_FAILED") {
    const payload = decodeImportFailedPayload(event);
    const url = `${applicationBaseUrl()}/conciliacao`;
    return {
      recipient: payload.to,
      subject: `Falha na importação — ${payload.companyName}`,
      text: `Olá, ${payload.name}. Não foi possível processar uma importação em ${payload.companyName}. Revise o formato do arquivo e tente novamente: ${url}`,
      html: renderEmailLayout({
        preheader: `Não foi possível processar uma importação em ${payload.companyName}.`,
        heading: "Falha na importação",
        bodyHtml:
          paragraph(`Olá, ${escapeHtml(payload.name)}.`) +
          paragraph(`Não foi possível processar uma importação em <strong>${escapeHtml(payload.companyName)}</strong>.`) +
          paragraph("Revise o formato do arquivo e tente novamente.", true),
        cta: { url, label: "Abrir conciliação" },
      }),
    };
  }

  if (event.type === "BILLING_NOTICE") {
    const payload = decodeBillingNoticePayload(event);
    const url = `${applicationBaseUrl()}${payload.href}`;
    return {
      recipient: payload.to,
      subject: `${payload.title} — ${payload.companyName}`,
      text: `Olá, ${payload.name}.\n${payload.body}\n${url}`,
      html: renderEmailLayout({
        preheader: payload.body,
        heading: payload.title,
        bodyHtml: paragraph(`Olá, ${escapeHtml(payload.name)}.`) + paragraph(escapeHtml(payload.body), true),
        cta: { url, label: "Abrir assinatura" },
      }),
    };
  }

  throw new Error(`Tipo de e-mail não suportado: ${event.type}`);
}

export async function sendOutboxEmail(event: OutboxEvent) {
  const { recipient, subject, text, html } = renderOutboxEmail(event);

  const smtp = transport();
  if (!smtp) {
    structuredLog("info", "worker.email_simulated", {
      outboxEventId: event.id,
      outboxEventType: event.type,
    });
    return;
  }
  await smtp.client.sendMail({
    from: smtp.from,
    to: recipient,
    subject,
    text,
    html,
    // Identificador estável ajuda provedores que deduplicam mensagens repetidas.
    messageId: `<${event.id}@ax-finance-outbox>`,
  });
}
