import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { withUserContext } from "@ax-finance/db";
import { registerUser } from "../identity/register";
import { getSmtpSettingsForAdmin, resolveSmtpConfig, sendSmtpTestEmail, updateSmtpSettings } from "../email/smtp-settings";
import { PlatformAdminAccessDeniedError, SmtpNotConfiguredError, SmtpPasswordRequiredError } from "../errors";
import { rootClient, resetDatabase } from "./test-db";

async function setupUser(label: string, role?: "SUPER_ADMIN" | "OPERATIONS" | "SUPPORT") {
  const user = await registerUser({ email: `${label}.${randomUUID()}@teste.ax.finance`, name: `Pessoa ${label}`, password: "senha-forte-123" });
  if (role) {
    await rootClient.platformAdmin.create({ data: { userId: user.id, role } });
    await rootClient.user.update({ where: { id: user.id }, data: { mfaEnabledAt: new Date() } });
  }
  return user;
}

const input = {
  enabled: true,
  host: "smtp.exemplo.com",
  port: 587,
  security: "starttls",
  username: "envio@exemplo.com",
  password: "segredo-super-forte",
  fromName: "AX Finance",
  fromEmail: "no-reply@exemplo.com",
};

const ENV_KEYS = ["SMTP_HOST", "SMTP_FROM", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "SMTP_SECURE"] as const;
const savedEnv: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

beforeEach(async () => {
  await resetDatabase();
  for (const key of ENV_KEYS) { savedEnv[key] = process.env[key]; delete process.env[key]; }
});
afterEach(() => {
  for (const key of ENV_KEYS) { if (savedEnv[key] === undefined) delete process.env[key]; else process.env[key] = savedEnv[key]; }
});
afterAll(async () => rootClient.$disconnect());

describe("configuração do SMTP no painel", () => {
  it("super administrador salva; a senha fica cifrada e não volta para a tela", async () => {
    const admin = await setupUser("super", "SUPER_ADMIN");
    await updateSmtpSettings(admin.id, input);

    const row = await rootClient.smtpSettings.findUniqueOrThrow({ where: { id: "default" } });
    expect(row.passwordEncrypted).toMatch(/^v1:/);
    expect(row.passwordEncrypted).not.toContain("segredo");
    expect(row.fromAddress).toBe('"AX Finance" <no-reply@exemplo.com>');

    const view = await getSmtpSettingsForAdmin(admin.id);
    expect(view.source).toBe("database");
    expect(view.stored).toMatchObject({ host: "smtp.exemplo.com", hasPassword: true });
    expect(JSON.stringify(view)).not.toContain("segredo");

    const audit = await rootClient.adminAuditEvent.findFirstOrThrow({ where: { action: "SMTP_SETTINGS_UPDATED" } });
    expect(JSON.stringify(audit)).not.toContain("segredo");
  });

  it("o envio usa a configuração do painel e, desligada, volta para as variáveis do servidor", async () => {
    const admin = await setupUser("fonte", "SUPER_ADMIN");
    process.env.SMTP_HOST = "smtp.servidor.local";
    process.env.SMTP_FROM = "Servidor <s@servidor.local>";
    expect(await resolveSmtpConfig({ fresh: true })).toMatchObject({ source: "environment", host: "smtp.servidor.local" });

    await updateSmtpSettings(admin.id, input);
    expect(await resolveSmtpConfig()).toMatchObject({ source: "database", host: "smtp.exemplo.com", password: "segredo-super-forte", secure: false });

    // Sem senha nova, mantém a salva; desligar devolve o .env.
    await updateSmtpSettings(admin.id, { ...input, password: "", enabled: false });
    expect(await resolveSmtpConfig()).toMatchObject({ source: "environment" });
    await updateSmtpSettings(admin.id, { ...input, password: "", security: "ssl", port: 465 });
    expect(await resolveSmtpConfig()).toMatchObject({ source: "database", password: "segredo-super-forte", secure: true, port: 465 });
  });

  it("só o super administrador altera; operações apenas vê; cliente comum não lê a tabela", async () => {
    const operations = await setupUser("ops", "OPERATIONS");
    const common = await setupUser("comum");
    await expect(updateSmtpSettings(operations.id, input)).rejects.toBeInstanceOf(PlatformAdminAccessDeniedError);
    await expect(getSmtpSettingsForAdmin(common.id)).rejects.toBeInstanceOf(PlatformAdminAccessDeniedError);
    expect((await getSmtpSettingsForAdmin(operations.id)).source).toBe("none");

    const admin = await setupUser("dono", "SUPER_ADMIN");
    await updateSmtpSettings(admin.id, input);
    // RLS: com um usuário comum no contexto (como numa requisição de cliente), a linha não aparece.
    const seen = await withUserContext(common.id, (tx) => tx.smtpSettings.findMany());
    expect(seen).toHaveLength(0);
  });

  it("recusa usuário sem senha e teste sem configuração", async () => {
    const admin = await setupUser("validacao", "SUPER_ADMIN");
    await expect(updateSmtpSettings(admin.id, { ...input, password: "" })).rejects.toBeInstanceOf(SmtpPasswordRequiredError);
    await expect(sendSmtpTestEmail(admin.id)).rejects.toBeInstanceOf(SmtpNotConfiguredError);
  });
});
