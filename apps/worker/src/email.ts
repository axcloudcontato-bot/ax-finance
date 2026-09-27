import nodemailer from "nodemailer";
import type { OutboxEvent } from "@ax-finance/db";
import {
  decodeDueDateSummaryPayload,
  decodeOutboxEmailPayload,
  decodeWeeklySummaryPayload,
} from "@ax-finance/domain";

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
  } else {
    throw new Error(`Tipo de e-mail não suportado: ${event.type}`);
  }

  const smtp = transport();
  if (!smtp) {
    console.info(`[outbox:${event.id}] e-mail simulado em desenvolvimento para ${recipient}`);
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
