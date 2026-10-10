import nodemailer from "nodemailer";
import { z } from "zod";
import { prisma, withUserContext } from "@ax-finance/db";
import { assertPlatformAdminInTx, recordAdminAudit } from "../admin/access";
import { SmtpNotConfiguredError, SmtpPasswordRequiredError, SmtpTestFailedError } from "../errors";
import { decryptSecretText, encryptSecretText } from "../outbox/events";

/** Configuração efetiva de envio: a salva no painel (quando ligada) ou a das variáveis SMTP_* do servidor. */
export type SmtpConfig = {
  source: "database" | "environment";
  host: string;
  port: number;
  secure: boolean;
  username: string | null;
  password: string | null;
  from: string;
};

const SETTINGS_ID = "default";
const CACHE_MS = 60_000;
let cache: { at: number; value: SmtpConfig | null } | null = null;

function environmentConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST?.trim();
  const from = process.env.SMTP_FROM?.trim();
  if (!host || !from) return null;
  const port = Number(process.env.SMTP_PORT || "587");
  return {
    source: "environment",
    host,
    port,
    secure: process.env.SMTP_SECURE === "true" || port === 465,
    username: process.env.SMTP_USER?.trim() || null,
    password: process.env.SMTP_PASSWORD || null,
    from,
  };
}

/**
 * O que o envio deve usar agora. Lido fora de contexto de usuário (o RLS libera para o worker) e guardado
 * por um minuto: salvar no painel vale para o worker em até 60 s, sem reiniciar nada.
 */
export async function resolveSmtpConfig(options: { fresh?: boolean } = {}): Promise<SmtpConfig | null> {
  if (!options.fresh && cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  const stored = await prisma.smtpSettings.findUnique({ where: { id: SETTINGS_ID } });
  const value: SmtpConfig | null = stored?.enabled
    ? {
      source: "database",
      host: stored.host,
      port: stored.port,
      secure: stored.secure,
      username: stored.username,
      password: stored.passwordEncrypted ? decryptSecretText(stored.passwordEncrypted) : null,
      from: stored.fromAddress,
    }
    : environmentConfig();
  cache = { at: Date.now(), value };
  return value;
}

export function createSmtpTransport(config: SmtpConfig) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.username && config.password ? { user: config.username, pass: config.password } : undefined,
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
  });
}

/** Painel: o que está salvo (sem a senha) e de onde vem a configuração em uso. */
export async function getSmtpSettingsForAdmin(userId: string) {
  const stored = await withUserContext(userId, async (tx) => {
    await assertPlatformAdminInTx(tx, userId, ["SUPER_ADMIN", "OPERATIONS"]);
    return tx.smtpSettings.findUnique({
      where: { id: SETTINGS_ID },
      include: { updatedBy: { select: { name: true } } },
    });
  });
  const env = environmentConfig();
  const source: SmtpConfig["source"] | "none" = stored?.enabled ? "database" : env ? "environment" : "none";
  return {
    source,
    stored: stored
      ? {
        enabled: stored.enabled,
        host: stored.host,
        port: stored.port,
        secure: stored.secure,
        username: stored.username,
        hasPassword: Boolean(stored.passwordEncrypted),
        fromAddress: stored.fromAddress,
        updatedAt: stored.updatedAt,
        updatedByName: stored.updatedBy?.name ?? null,
      }
      : null,
    environment: env ? { host: env.host, port: env.port, from: env.from } : null,
  };
}

const optionalText = (max: number) => z.string().trim().max(max).optional().transform((value) => value || null);

const updateInput = z.object({
  enabled: z.boolean(),
  host: z.string().trim().min(1).max(255).regex(/^[a-z0-9.-]+$/i, "Servidor inválido"),
  port: z.coerce.number().int().min(1).max(65535),
  security: z.enum(["starttls", "ssl"]),
  username: optionalText(255),
  /** Vazio mantém a senha salva. */
  password: z.string().max(500).optional(),
  clearPassword: z.boolean().default(false),
  fromName: optionalText(120),
  fromEmail: z.string().trim().email().max(255),
});

function formatFrom(name: string | null, email: string) {
  if (!name) return email;
  return `"${name.replace(/["\\]/g, "")}" <${email}>`;
}

/** Salva a configuração do SMTP (só super administrador). A senha nunca entra na auditoria. */
export async function updateSmtpSettings(userId: string, rawInput: unknown) {
  const data = updateInput.parse(rawInput);
  const result = await withUserContext(userId, async (tx) => {
    await assertPlatformAdminInTx(tx, userId, ["SUPER_ADMIN"]);
    const current = await tx.smtpSettings.findUnique({ where: { id: SETTINGS_ID } });
    const passwordEncrypted = data.password
      ? encryptSecretText(data.password)
      : data.clearPassword ? null : current?.passwordEncrypted ?? null;
    if (data.username && !passwordEncrypted) throw new SmtpPasswordRequiredError();
    const values = {
      enabled: data.enabled,
      host: data.host,
      port: data.port,
      secure: data.security === "ssl",
      username: data.username,
      passwordEncrypted,
      fromAddress: formatFrom(data.fromName, data.fromEmail),
      updatedByUserId: userId,
    };
    const saved = await tx.smtpSettings.upsert({ where: { id: SETTINGS_ID }, create: { id: SETTINGS_ID, ...values }, update: values });
    await recordAdminAudit(tx, {
      actorUserId: userId,
      action: "SMTP_SETTINGS_UPDATED",
      targetType: "SmtpSettings",
      targetId: SETTINGS_ID,
      summary: `${data.enabled ? "Ligou" : "Desligou"} o SMTP do painel: ${data.host}:${data.port}${data.password ? " (senha alterada)" : data.clearPassword ? " (senha removida)" : ""}.`,
      metadata: { host: data.host, port: data.port, security: data.security, enabled: data.enabled, passwordChanged: Boolean(data.password) || data.clearPassword },
    });
    return saved;
  });
  cache = null;
  return result;
}

/** Envia um e-mail de teste com a configuração em uso, para o próprio administrador. */
export async function sendSmtpTestEmail(userId: string) {
  const admin = await withUserContext(userId, async (tx) => {
    const access = await assertPlatformAdminInTx(tx, userId, ["SUPER_ADMIN", "OPERATIONS"]);
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true, name: true } });
    return { ...access, ...user };
  });
  const config = await resolveSmtpConfig({ fresh: true });
  if (!config) throw new SmtpNotConfiguredError();
  const transport = createSmtpTransport(config);
  try {
    await transport.verify();
    await transport.sendMail({
      from: config.from,
      to: admin.email,
      subject: "Teste de envio — AX Finance",
      text: `Olá, ${admin.name}.\n\nEste é um e-mail de teste do AX Finance. Se ele chegou, o servidor de e-mail (${config.host}:${config.port}) está funcionando.`,
      html: `<p>Olá, ${admin.name.replace(/[<>&"]/g, "")}.</p><p>Este é um e-mail de teste do AX Finance. Se ele chegou, o servidor de e-mail (<strong>${config.host}:${config.port}</strong>) está funcionando.</p>`,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message.slice(0, 300) : "erro desconhecido";
    throw new SmtpTestFailedError(detail);
  } finally {
    transport.close();
  }
  await withUserContext(userId, (tx) => recordAdminAudit(tx, {
    actorUserId: userId,
    action: "SMTP_TEST_SENT",
    targetType: "SmtpSettings",
    targetId: SETTINGS_ID,
    summary: `E-mail de teste enviado para ${admin.email} via ${config.host}:${config.port} (${config.source === "database" ? "painel" : "variáveis do servidor"}).`,
  }));
  return { to: admin.email, source: config.source };
}
