import { formatCents } from "./currency";
import { formatDateOnly } from "./dates";

/**
 * Mensagem de cobrança de um recebível, pronta para copiar ou abrir no e-mail. Texto neutro e cordial:
 * a pessoa pode (e deve) ajustar antes de enviar. Os dados de pagamento só entram se o lançamento tiver.
 */
export function buildCollectionMessage(input: {
  companyName: string;
  partyName?: string | null;
  description: string;
  remainingCents: bigint;
  currency?: string;
  dueDate: Date | string;
  /** Dias de atraso, se vencido (0 ou negativo = ainda a vencer). */
  daysLate: number;
  paymentCode?: string | null;
  /** "PIX copia e cola" com o valor já preenchido. */
  pixCode?: string | null;
}): { subject: string; body: string } {
  const amount = formatCents(input.remainingCents, input.currency ?? "BRL");
  const due = formatDateOnly(input.dueDate);
  const greeting = input.partyName ? `Olá, ${input.partyName}!` : "Olá!";
  const situation = input.daysLate > 0
    ? `Identificamos que o valor de ${amount}, referente a "${input.description}", venceu em ${due} (${input.daysLate} ${input.daysLate === 1 ? "dia" : "dias"} de atraso) e ainda consta em aberto.`
    : `Passando para lembrar que o valor de ${amount}, referente a "${input.description}", vence em ${due}.`;
  const payment = input.pixCode
    ? `\n\nPara pagar por PIX, use o código copia e cola abaixo (o valor já vem preenchido):\n${input.pixCode}`
    : input.paymentCode ? `\n\nDados para pagamento: ${input.paymentCode}` : "";
  const close = input.daysLate > 0
    ? "\n\nSe o pagamento já foi feito, por favor desconsidere esta mensagem e nos envie o comprovante. Caso precise combinar uma nova data, responda por aqui."
    : "\n\nQualquer dúvida, é só responder esta mensagem.";
  return {
    subject: input.daysLate > 0 ? `Pagamento em aberto: ${input.description}` : `Lembrete de vencimento: ${input.description}`,
    body: `${greeting}\n\n${situation}${payment}${close}\n\nAtenciosamente,\n${input.companyName}`,
  };
}

export function mailtoHref(to: string | null | undefined, message: { subject: string; body: string }): string | null {
  if (!to) return null;
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(message.subject)}&body=${encodeURIComponent(message.body)}`;
}

/**
 * Link do WhatsApp com a mensagem preenchida. Com telefone, abre a conversa do cliente (números
 * brasileiros sem DDI ganham o 55); sem telefone, o próprio WhatsApp pede para escolher o contato.
 */
export function whatsappHref(phone: string | null | undefined, body: string): string {
  let digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  const valid = digits.length >= 12 && digits.length <= 13;
  return `https://wa.me/${valid ? digits : ""}?text=${encodeURIComponent(body)}`;
}
