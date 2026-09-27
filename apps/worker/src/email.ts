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

const ROLE_LABEL: Record<string, string> = {
  FINANCE_ADMIN: "Administrador financeiro",
  OPERATOR: "Operador",
  ACCOUNTANT: "Contador",
  VIEWER: "Consulta",
};

function applicationBaseUrl() {
  const configured = process.env.APP_BASE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  if (process.env.NODE_ENV === "production") throw new Error("APP_BASE_URL não configurada no worker.");
  return "http://localhost:3000";
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character]!);
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

export async function sendOutboxEmail(event: OutboxEvent) {
  let subject: string;
  let text: string;
  let html: string;
  let recipient: string;

  if (event.type === "EMAIL_VERIFICATION") {
    const payload = decodeOutboxEmailPayload(event);
    const safeName = escapeHtml(payload.name);
    recipient = payload.to;
    const path = `/verificar-email/${payload.rawToken}${payload.returnTo ? `?retorno=${encodeURIComponent(payload.returnTo)}` : ""}`;
    const url = `${payload.baseUrl}${path}`;
    const safeUrl = escapeHtml(url);
    subject = "Confirme seu e-mail no AX Finance";
    text = `Olá, ${payload.name}. Confirme seu e-mail acessando: ${url}\nO link expira em 24 horas.`;
    html = `<p>Olá, ${safeName}.</p><p>Confirme seu e-mail para ativar o acesso ao AX Finance:</p><p><a href="${safeUrl}">Confirmar e-mail</a></p><p>O link expira em 24 horas.</p>`;
  } else if (event.type === "PASSWORD_RESET") {
    const payload = decodeOutboxEmailPayload(event);
    const safeName = escapeHtml(payload.name);
    recipient = payload.to;
    const url = `${payload.baseUrl}/redefinir-senha/${payload.rawToken}`;
    const safeUrl = escapeHtml(url);
    subject = "Redefinição de senha do AX Finance";
    text = `Olá, ${payload.name}. Redefina sua senha acessando: ${url}\nO link expira em 1 hora.`;
    html = `<p>Olá, ${safeName}.</p><p>Recebemos uma solicitação para redefinir sua senha:</p><p><a href="${safeUrl}">Redefinir senha</a></p><p>O link expira em 1 hora. Se não foi você, ignore esta mensagem.</p>`;
  } else if (event.type === "DUE_DATE_SUMMARY") {
    const payload = decodeDueDateSummaryPayload(event);
    recipient = payload.to;
    const rows = payload.items.map((item) => {
      const label = item.type === "RECEIVABLE" ? "Entrada" : "Saída";
      return `${label}: ${item.description} — ${item.overdue ? "vencido em" : "vence em"} ${item.dueDate}`;
    });
    const htmlRows = payload.items.map((item) => {
      const label = item.type === "RECEIVABLE" ? "Entrada" : "Saída";
      const url = `${payload.baseUrl}${item.href}`;
      return `<li><a href="${escapeHtml(url)}">${escapeHtml(label)}: ${escapeHtml(item.description)}</a> — ${item.overdue ? "vencido em" : "vence em"} ${escapeHtml(item.dueDate)}</li>`;
    }).join("");
    subject = `Títulos vencidos e do dia — ${payload.companyName}`;
    text = `Olá, ${payload.name}.\n\n${rows.join("\n")}\n\nAcesse: ${payload.baseUrl}`;
    html = `<p>Olá, ${escapeHtml(payload.name)}.</p><p>Estes títulos precisam de atenção em <strong>${escapeHtml(payload.companyName)}</strong>:</p><ul>${htmlRows}</ul>`;
  } else if (event.type === "WEEKLY_SUMMARY") {
    const payload = decodeWeeklySummaryPayload(event);
    recipient = payload.to;
    const money = (cents: string) => new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(Number(BigInt(cents)) / 100);
    const url = `${payload.baseUrl}/relatorios/fluxo-de-caixa`;
    subject = `Resumo financeiro semanal — ${payload.companyName}`;
    text = `Olá, ${payload.name}.\nEntradas em aberto: ${money(payload.receivableOpenCents)}\nSaídas em aberto: ${money(payload.payableOpenCents)}\nVencidos: ${payload.overdueCount}\nPróximos 7 dias: ${payload.dueNext7Count}\n${url}`;
    html = `<p>Olá, ${escapeHtml(payload.name)}.</p><p>Resumo semanal de <strong>${escapeHtml(payload.companyName)}</strong>:</p><ul><li>Entradas em aberto: ${escapeHtml(money(payload.receivableOpenCents))}</li><li>Saídas em aberto: ${escapeHtml(money(payload.payableOpenCents))}</li><li>Vencidos: ${payload.overdueCount}</li><li>Próximos 7 dias: ${payload.dueNext7Count}</li></ul><p><a href="${escapeHtml(url)}">Abrir relatórios</a></p>`;
  } else if (event.type === "COMPANY_INVITATION") {
    const payload = decodeCompanyInvitationPayload(event);
    recipient = payload.to;
    const url = `${applicationBaseUrl()}/convites/${payload.rawToken}`;
    const role = ROLE_LABEL[payload.role] || payload.role;
    subject = `Convite para acessar ${payload.companyName}`;
    text = `${payload.invitedByName} convidou você para acessar ${payload.companyName} como ${role}.\nAceite o convite: ${url}\nO convite expira em ${new Date(payload.expiresAt).toLocaleDateString("pt-BR", { timeZone: "UTC" })}.`;
    html = `<p><strong>${escapeHtml(payload.invitedByName)}</strong> convidou você para acessar <strong>${escapeHtml(payload.companyName)}</strong> como ${escapeHtml(role)}.</p><p><a href="${escapeHtml(url)}">Aceitar convite</a></p><p>O convite expira em ${escapeHtml(new Date(payload.expiresAt).toLocaleDateString("pt-BR", { timeZone: "UTC" }))}.</p>`;
  } else if (event.type === "ACCESS_CHANGED") {
    const payload = decodeAccessChangedPayload(event);
    recipient = payload.to;
    const role = payload.role ? ROLE_LABEL[payload.role] || payload.role : undefined;
    const messages = {
      ROLE_CHANGED: `Seu papel em ${payload.companyName} foi alterado para ${role}.`,
      ACCESS_REVOKED: `Seu acesso a ${payload.companyName} foi revogado.`,
      INVITATION_ACCEPTED: `${payload.targetName || "O usuário convidado"} aceitou o convite para acessar ${payload.companyName}.`,
      INVITATION_REVOKED: `O convite para acessar ${payload.companyName} foi revogado.`,
    } as const;
    const message = messages[payload.kind];
    subject = payload.kind === "INVITATION_ACCEPTED" ? `Convite aceito — ${payload.companyName}` : `Alteração de acesso — ${payload.companyName}`;
    text = `${message}${payload.actorName ? `\nAlteração realizada por ${payload.actorName}.` : ""}`;
    html = `<p>${escapeHtml(message)}</p>${payload.actorName ? `<p>Alteração realizada por ${escapeHtml(payload.actorName)}.</p>` : ""}`;
  } else if (event.type === "IMPORT_FAILED") {
    const payload = decodeImportFailedPayload(event);
    recipient = payload.to;
    const url = `${applicationBaseUrl()}/conciliacao`;
    subject = `Falha na importação — ${payload.companyName}`;
    text = `Olá, ${payload.name}. Não foi possível processar uma importação em ${payload.companyName}. Revise o formato do arquivo e tente novamente: ${url}`;
    html = `<p>Olá, ${escapeHtml(payload.name)}.</p><p>Não foi possível processar uma importação em <strong>${escapeHtml(payload.companyName)}</strong>.</p><p>Revise o formato do arquivo e tente novamente.</p><p><a href="${escapeHtml(url)}">Abrir conciliação</a></p>`;
  } else if (event.type === "BILLING_NOTICE") {
    const payload = decodeBillingNoticePayload(event);
    recipient = payload.to;
    const url = `${applicationBaseUrl()}${payload.href}`;
    subject = `${payload.title} — ${payload.companyName}`;
    text = `Olá, ${payload.name}.\n${payload.body}\n${url}`;
    html = `<p>Olá, ${escapeHtml(payload.name)}.</p><p>${escapeHtml(payload.body)}</p><p><a href="${escapeHtml(url)}">Abrir assinatura</a></p>`;
  } else {
    throw new Error(`Tipo de e-mail não suportado: ${event.type}`);
  }

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
