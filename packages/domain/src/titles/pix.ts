import { z } from "zod";
import { withCompanyContext } from "@ax-finance/db";
import { recordAuditEvent } from "../audit/record-audit-event";
import { assertActiveMembership } from "../companies/assert-membership";
import { assertCompanyPermission } from "../companies/permissions";
import { InvalidPixKeyError } from "../errors";

/**
 * "PIX copia e cola" (BR Code estático do Banco Central): texto no formato EMV, campo a campo
 * (ID de 2 dígitos + tamanho de 2 dígitos + valor), terminado pelo CRC16 do texto todo. O mesmo texto
 * vira o QR Code. Não depende de banco: qualquer app de banco lê e já mostra valor e recebedor.
 */

export type PixKeyType = "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "RANDOM";

const digits = (value: string) => value.replace(/\D/g, "");

function validCpf(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const check = (length: number) => {
    let sum = 0;
    for (let index = 0; index < length; index += 1) sum += Number(cpf[index]) * (length + 1 - index);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return check(9) === Number(cpf[9]) && check(10) === Number(cpf[10]);
}

function validCnpj(cnpj: string): boolean {
  if (!/^\d{14}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) return false;
  const check = (length: number) => {
    const weights = length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((total, weight, index) => total + Number(cnpj[index]) * weight, 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  return check(12) === Number(cnpj[12]) && check(13) === Number(cnpj[13]);
}

/** Leva a chave ao formato que o PIX espera (CPF/CNPJ só dígitos, telefone +55..., e-mail minúsculo) ou null se não é chave válida. */
export function normalizePixKey(raw: string | null | undefined): { key: string; type: PixKeyType } | null {
  const value = (raw ?? "").trim();
  if (!value) return null;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) return { key: value.toLowerCase(), type: "RANDOM" };
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 77) return { key: value.toLowerCase(), type: "EMAIL" };
  const only = digits(value);
  if (value.startsWith("+")) return /^\d{12,13}$/.test(only) && only.startsWith("55") ? { key: `+${only}`, type: "PHONE" } : null;
  if (only.length === 14 && validCnpj(only)) return { key: only, type: "CNPJ" };
  if (only.length === 11 && validCpf(only)) return { key: only, type: "CPF" };
  // celular/fixo com DDD (10 ou 11 dígitos) sem o +55
  if (/^[1-9]{2}9?\d{8}$/.test(only) && (only.length === 10 || only.length === 11)) return { key: `+55${only}`, type: "PHONE" };
  return null;
}

/** Sem acento e só letras, números e espaço (o que todo app de banco aceita), cortado no limite do campo. */
function plainText(value: string, max: number): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max)
    .trim();
}

function field(id: string, value: string): string {
  return `${id}${String(value.length).padStart(2, "0")}${value}`;
}

/** CRC16-CCITT (polinômio 0x1021, início 0xFFFF), exigido no fim do BR Code. */
export function crc16Ccitt(text: string): string {
  let crc = 0xffff;
  for (const byte of Buffer.from(text, "utf8")) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit += 1) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function buildPixBrCode(input: {
  key: string;
  receiverName: string;
  city: string;
  amountCents?: bigint | number | null;
  /** Identificador da cobrança (só letras e números, até 25). */
  txid?: string | null;
  description?: string | null;
}): string {
  const normalized = normalizePixKey(input.key);
  if (!normalized) throw new InvalidPixKeyError();
  const description = input.description ? plainText(input.description, 40) : "";
  const account = field("00", "br.gov.bcb.pix") + field("01", normalized.key) + (description ? field("02", description) : "");
  const amount = input.amountCents !== null && input.amountCents !== undefined && BigInt(input.amountCents) > BigInt(0)
    ? (Number(input.amountCents) / 100).toFixed(2)
    : null;
  const txid = (input.txid ?? "").replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || "***";
  const payload = [
    field("00", "01"),
    field("26", account),
    field("52", "0000"),
    field("53", "986"),
    amount ? field("54", amount) : "",
    field("58", "BR"),
    field("59", plainText(input.receiverName, 25) || "RECEBEDOR"),
    field("60", plainText(input.city, 15) || "BRASIL"),
    field("62", field("05", txid)),
    "6304",
  ].join("");
  return payload + crc16Ccitt(payload);
}

export const pixSettingsInput = z.object({
  pixKey: z.string().trim().max(120).nullish(),
  pixReceiverName: z.string().trim().max(60).nullish(),
  pixCity: z.string().trim().max(60).nullish(),
});

export async function getPixSettings(userId: string, companyId: string) {
  await assertActiveMembership(userId, companyId);
  const company = await withCompanyContext(userId, companyId, (tx) =>
    tx.company.findUniqueOrThrow({ where: { id: companyId }, select: { name: true, pixKey: true, pixReceiverName: true, pixCity: true } }),
  );
  return {
    pixKey: company.pixKey,
    pixReceiverName: company.pixReceiverName ?? company.name,
    pixCity: company.pixCity,
    configured: Boolean(company.pixKey),
  };
}

/** Chave vazia desliga o PIX nas cobranças; chave preenchida precisa ser válida (CPF, CNPJ, e-mail, telefone ou aleatória). */
export async function updatePixSettings(userId: string, companyId: string, rawInput: unknown) {
  const data = pixSettingsInput.parse(rawInput);
  const key = data.pixKey ? normalizePixKey(data.pixKey) : null;
  if (data.pixKey && !key) throw new InvalidPixKeyError();
  await assertCompanyPermission(userId, companyId, "FINANCE_WRITE");
  return withCompanyContext(userId, companyId, async (tx) => {
    await tx.company.update({
      where: { id: companyId },
      data: { pixKey: key?.key ?? null, pixReceiverName: data.pixReceiverName || null, pixCity: data.pixCity || null },
    });
    await recordAuditEvent(tx, {
      companyId, actorUserId: userId, eventType: "PIX_SETTINGS_UPDATED", resourceType: "Company", resourceId: companyId,
      summary: key ? `Chave PIX (${key.type}) configurada para cobranças` : "PIX removido das cobranças",
    });
  });
}
