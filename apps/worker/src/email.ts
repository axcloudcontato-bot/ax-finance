import nodemailer from "nodemailer";
import type { OutboxEvent } from "@ax-finance/db";
import { structuredLog } from "@ax-finance/domain";
import {
  decodeAccessChangedPayload,
  decodeBillingNoticePayload,
  decodeCompanyInvitationPayload,
  decodeDueDateSummaryPayload,
  decodeImportFailedPayload,
  decodeMonthlyReportPayload,
  getMonthlyReportData,
  renderMonthlyReportPdf,
  type MonthlyReportData,
  decodeOutboxEmailPayload,
  decodeWeeklySummaryPayload,
  axLogoPng,
} from "@ax-finance/domain";
import { LOGO_CID, escapeHtml, itemList, metricTiles, paragraph, renderEmailLayout, sectionTitle, type EmailTone, type MetricTile } from "./email-layout";

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

export type RenderedEmail = { recipient: string; subject: string; text: string; html: string; attachments?: { filename: string; content: Buffer; contentType: string }[] };

const brl = (cents: bigint) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(cents) / 100);

/** E-mail do relatório mensal: os números principais no corpo e o PDF completo em anexo. */
export function renderMonthlyReportEmail(payload: { to: string; name: string; companyName: string; baseUrl: string; month: string }, data: MonthlyReportData, pdf: Buffer): RenderedEmail {
  const url = `${payload.baseUrl}/relatorios/mensal?mes=${payload.month}`;
  const lines = [
    `Receitas: ${brl(data.result.revenueCents)}`,
    `Despesas: ${brl(data.result.expenseCents)}`,
    `Resultado: ${brl(data.result.resultCents)}`,
    `Vencido a receber: ${brl(data.delinquency.overdueReceivableCents)}`,
    `Saldo previsto em 30 dias: ${brl(data.projection.projectedCents)}`,
  ];
  const tiles: MetricTile[] = [
    { label: "Receitas", value: brl(data.result.revenueCents), tone: "success" },
    { label: "Despesas", value: brl(data.result.expenseCents), tone: "accent" },
    { label: "Resultado", value: brl(data.result.resultCents), tone: data.result.resultCents < BigInt(0) ? "danger" : "success" },
    { label: "Vencido a receber", value: brl(data.delinquency.overdueReceivableCents), tone: data.delinquency.overdueReceivableCents > BigInt(0) ? "warning" : "neutral" },
    { label: "Saldo em 30 dias", value: brl(data.projection.projectedCents), hint: "previsto", tone: data.projection.projectedCents < BigInt(0) ? "danger" : "neutral" },
  ];
  return {
    recipient: payload.to,
    subject: `Relatório de ${data.monthLabel} — ${payload.companyName}`,
    text: `Olá, ${payload.name}.\nO relatório de ${data.monthLabel} de ${payload.companyName} está em anexo (PDF).\n${lines.join("\n")}\n${url}`,
    html: renderEmailLayout({
      preheader: `Resultado de ${data.monthLabel}: ${brl(data.result.resultCents)}.`,
      heading: `Relatório de ${data.monthLabel}`,
      bodyHtml:
        paragraph(`Olá, ${escapeHtml(payload.name)}. O relatório completo de <strong>${escapeHtml(payload.companyName)}</strong> está em anexo, em PDF. Os principais números:`) +
        metricTiles(tiles),
      cta: { url, label: "Ver no AX Finance" },
      note: "Você recebe este e-mail no início de cada mês. Para parar, desligue em Configurações > Notificações.",
    }),
    attachments: [{ filename: `relatorio-${payload.month}.pdf`, content: pdf, contentType: "application/pdf" }],
  };
}

const DAY_MS = 86_400_000;

function formatDay(value: string) {
  return value.split("-").reverse().join("/");
}

function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

function money(cents: string | bigint, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(Number(BigInt(cents)) / 100);
}

type DueDateSummaryPayload = ReturnType<typeof decodeDueDateSummaryPayload>;
type DueItem = DueDateSummaryPayload["items"][number];

/**
 * Resumo diário de vencimentos: totais no topo e os títulos agrupados em vencidos, do dia e próximos.
 * Avisos antigos da fila (sem `today`/valor) ainda renderizam, só com menos detalhe.
 */
export function renderDueDateSummaryEmail(payload: DueDateSummaryPayload): RenderedEmail {
  const today = payload.today;
  const groupOf = (item: DueItem): "overdue" | "today" | "upcoming" =>
    item.overdue ? "overdue" : today && item.dueDate === today ? "today" : "upcoming";
  const groups = {
    overdue: payload.items.filter((item) => groupOf(item) === "overdue"),
    today: payload.items.filter((item) => groupOf(item) === "today"),
    upcoming: payload.items.filter((item) => groupOf(item) === "upcoming"),
  };
  const hasAmounts = payload.items.every((item) => item.remainingCents !== undefined);
  const total = (items: DueItem[]) => money(items.reduce((sum, item) => sum + BigInt(item.remainingCents ?? "0"), BigInt(0)));
  const countLabel = (count: number) => `${count} ${count === 1 ? "título" : "títulos"}`;
  const dueText = (item: DueItem): { text: string; tone?: EmailTone } => {
    if (item.overdue) {
      const late = today ? daysBetween(item.dueDate, today) : 0;
      return { text: `venceu em ${formatDay(item.dueDate)}${late > 0 ? ` (${late} ${late === 1 ? "dia" : "dias"})` : ""}`, tone: "danger" };
    }
    if (groupOf(item) === "today") return { text: "vence hoje", tone: "warning" };
    return { text: `vence em ${formatDay(item.dueDate)}` };
  };
  const rowsOf = (items: DueItem[]) => itemList(items.map((item) => ({
    href: `${payload.baseUrl}${item.href}`,
    badge: item.type === "RECEIVABLE" ? { label: "A receber", tone: "success" as const } : { label: "A pagar", tone: "accent" as const },
    title: item.description,
    meta: [...(item.partyName ? [{ text: item.partyName }] : []), dueText(item)],
    amount: item.remainingCents === undefined ? undefined : money(item.remainingCents, item.currency),
  })));

  const sections = [
    { key: "overdue" as const, title: "Vencidos", tone: "danger" as const },
    { key: "today" as const, title: "Vencem hoje", tone: "warning" as const },
    { key: "upcoming" as const, title: today ? "Próximos dias" : "A vencer", tone: "neutral" as const },
  ].filter((section) => groups[section.key].length > 0);

  // Entradas e saídas não se somam: cada lado tem o seu cartão, e o terceiro conta o que já venceu.
  const receivables = payload.items.filter((item) => item.type === "RECEIVABLE");
  const payables = payload.items.filter((item) => item.type === "PAYABLE");
  const sideTile = (label: string, items: DueItem[], tone: EmailTone): MetricTile => hasAmounts
    ? { label, value: total(items), hint: countLabel(items.length), tone: items.length > 0 ? tone : "neutral" }
    : { label, value: String(items.length), hint: items.length === 1 ? "título" : "títulos", tone: items.length > 0 ? tone : "neutral" };
  const tiles: MetricTile[] = [
    sideTile("A receber", receivables, "success"),
    sideTile("A pagar", payables, "accent"),
    { label: "Vencidos", value: String(groups.overdue.length), hint: groups.overdue.length === 1 ? "título em atraso" : "títulos em atraso", tone: groups.overdue.length > 0 ? "danger" : "neutral" },
  ];

  const textLines = sections.flatMap((section) => [
    "",
    `${section.title.toUpperCase()} (${groups[section.key].length})`,
    ...groups[section.key].map((item) => {
      const kind = item.type === "RECEIVABLE" ? "A receber" : "A pagar";
      const amount = item.remainingCents === undefined ? "" : ` — ${money(item.remainingCents, item.currency)}`;
      return `- ${kind}: ${item.description}${item.partyName ? ` (${item.partyName})` : ""}${amount} — ${dueText(item).text}`;
    }),
  ]);
  const url = `${payload.baseUrl}/calendario`;
  const attention = groups.overdue.length + groups.today.length;

  return {
    recipient: payload.to,
    subject: attention > 0
      ? `${countLabel(attention)} ${attention === 1 ? "precisa" : "precisam"} de atenção — ${payload.companyName}`
      : `Próximos vencimentos — ${payload.companyName}`,
    text: `Olá, ${payload.name}.\nEstes são os vencimentos que precisam de atenção em ${payload.companyName}:\n${textLines.join("\n")}\n\nVer no AX Finance: ${url}`,
    html: renderEmailLayout({
      preheader: sections.map((section) => `${section.title}: ${groups[section.key].length}`).join(" · "),
      heading: "Seu resumo do dia",
      bodyHtml:
        paragraph(`Olá, ${escapeHtml(payload.name)}. Estes são os vencimentos que precisam de atenção em <strong>${escapeHtml(payload.companyName)}</strong>:`) +
        metricTiles(tiles) +
        sections.map((section) => sectionTitle(section.title, section.tone, groups[section.key].length) + rowsOf(groups[section.key])).join(""),
      cta: { url, label: "Abrir o calendário" },
      note: "Você recebe este resumo nos dias com vencimentos. Ajuste a antecedência, o horário ou desligue em Configurações &gt; Notificações.",
    }),
  };
}

/** Resumo de segunda-feira: o que está em aberto e o que vence na semana. */
export function renderWeeklySummaryEmail(payload: ReturnType<typeof decodeWeeklySummaryPayload>): RenderedEmail {
  const url = `${payload.baseUrl}/relatorios/fluxo-de-caixa`;
  const balance = BigInt(payload.receivableOpenCents) - BigInt(payload.payableOpenCents);
  const negative = balance < BigInt(0);
  const tiles: MetricTile[] = [
    { label: "A receber", value: money(payload.receivableOpenCents), hint: "em aberto", tone: "success" },
    { label: "A pagar", value: money(payload.payableOpenCents), hint: "em aberto", tone: "accent" },
    { label: "Vencidos", value: String(payload.overdueCount), hint: payload.overdueCount === 1 ? "título" : "títulos", tone: payload.overdueCount > 0 ? "danger" : "neutral" },
    { label: "Próximos 7 dias", value: String(payload.dueNext7Count), hint: payload.dueNext7Count === 1 ? "título vence" : "títulos vencem", tone: payload.dueNext7Count > 0 ? "warning" : "neutral" },
  ];
  const balanceText = `${negative ? "−" : ""}${money(negative ? -balance : balance)}`;
  return {
    recipient: payload.to,
    subject: `Resumo financeiro semanal — ${payload.companyName}`,
    text: `Olá, ${payload.name}.\nResumo semanal de ${payload.companyName}:\n- A receber em aberto: ${money(payload.receivableOpenCents)}\n- A pagar em aberto: ${money(payload.payableOpenCents)}\n- Vencidos: ${payload.overdueCount}\n- Próximos 7 dias: ${payload.dueNext7Count}\n\nVer relatórios: ${url}`,
    html: renderEmailLayout({
      preheader: `Resumo semanal de ${payload.companyName}: ${payload.overdueCount} vencido(s), ${payload.dueNext7Count} para os próximos 7 dias.`,
      heading: "Resumo financeiro semanal",
      bodyHtml:
        paragraph(`Olá, ${escapeHtml(payload.name)}. Como está <strong>${escapeHtml(payload.companyName)}</strong> no começo da semana:`) +
        metricTiles(tiles, 2) +
        paragraph(`Diferença entre o que entra e o que sai em aberto: <strong style="color:${negative ? "#b4235a" : "#0f7a55"};">${escapeHtml(balanceText)}</strong>.`, true),
      cta: { url, label: "Abrir relatórios" },
      note: "Você recebe este resumo às segundas-feiras. Para parar, desligue em Configurações &gt; Notificações.",
    }),
  };
}

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

  if (event.type === "DUE_DATE_SUMMARY") return renderDueDateSummaryEmail(decodeDueDateSummaryPayload(event));

  if (event.type === "WEEKLY_SUMMARY") return renderWeeklySummaryEmail(decodeWeeklySummaryPayload(event));

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

async function renderEmail(event: OutboxEvent): Promise<RenderedEmail> {
  if (event.type === "MONTHLY_REPORT") {
    const payload = decodeMonthlyReportPayload(event);
    const data = await getMonthlyReportData(payload.userId, payload.companyId, payload.month);
    return renderMonthlyReportEmail(payload, data, await renderMonthlyReportPdf(data));
  }
  return renderOutboxEmail(event);
}

export async function sendOutboxEmail(event: OutboxEvent) {
  const { recipient, subject, text, html, attachments } = await renderEmail(event);

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
    attachments: [...(attachments ?? []), { filename: "ax-finance.png", content: axLogoPng(), contentType: "image/png", cid: LOGO_CID, contentDisposition: "inline" as const }],
    // Identificador estável ajuda provedores que deduplicam mensagens repetidas.
    messageId: `<${event.id}@ax-finance-outbox>`,
  });
}
