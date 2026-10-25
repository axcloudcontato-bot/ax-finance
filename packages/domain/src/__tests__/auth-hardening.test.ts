import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { registerUser, requestSignUp } from "../identity/register";
import { recordLoginFailure } from "../identity/login-rate-limit";
import { login } from "../identity/login";
import { resolveSession } from "../identity/session";
import {
  issueEmailVerificationToken,
  requestPasswordReset,
  resetPassword,
  verifyEmail,
} from "../identity/account-tokens";
import {
  EmailNotVerifiedError,
  InvalidAccountTokenError,
  InvalidCredentialsError,
  TooManyLoginAttemptsError,
} from "../errors";
import { rootClient, resetDatabase } from "./test-db";

function uniqueEmail(label: string) {
  return `${label}.${randomUUID()}@teste.ax.finance`;
}

beforeEach(async () => resetDatabase());
afterAll(async () => rootClient.$disconnect());

describe("endurecimento da autenticação", () => {
  it("exige verificação nos cadastros públicos e aceita o token uma única vez", async () => {
    const user = await registerUser(
      { email: uniqueEmail("verify"), name: "Verificação", password: "senha-forte-123" },
      { requireEmailVerification: true }
    );

    await expect(login({ email: user.email, password: "senha-forte-123" })).rejects.toBeInstanceOf(
      EmailNotVerifiedError
    );
    const verification = await issueEmailVerificationToken(user.id);
    expect(verification).not.toBeNull();
    await verifyEmail(verification!.rawToken);
    await expect(verifyEmail(verification!.rawToken)).rejects.toBeInstanceOf(InvalidAccountTokenError);
    await expect(login({ email: user.email, password: "senha-forte-123" })).resolves.toHaveProperty("session.rawToken");
  });

  it("redefine a senha, invalida o link e revoga sessões anteriores", async () => {
    const user = await registerUser({ email: uniqueEmail("reset"), name: "Reset", password: "senha-antiga-123" });
    const loginResult = await login({ email: user.email, password: "senha-antiga-123" });
    if (loginResult.mfaRequired) throw new Error("MFA não deveria estar ativa neste teste");
    const { session } = loginResult;
    expect(await resolveSession(session.rawToken)).not.toBeNull();

    const request = await requestPasswordReset(user.email);
    expect(request).not.toBeNull();
    await resetPassword(request!.rawToken, "senha-nova-456");

    expect(await resolveSession(session.rawToken)).toBeNull();
    await expect(login({ email: user.email, password: "senha-antiga-123" })).rejects.toBeInstanceOf(
      InvalidCredentialsError
    );
    await expect(login({ email: user.email, password: "senha-nova-456" })).resolves.toHaveProperty("session.rawToken");
    await expect(resetPassword(request!.rawToken, "outra-senha-789")).rejects.toBeInstanceOf(
      InvalidAccountTokenError
    );
  });

  it("não revela e-mail inexistente e bloqueia tentativas repetidas", async () => {
    expect(await requestPasswordReset(uniqueEmail("missing"))).toBeNull();
    const user = await registerUser({ email: uniqueEmail("limit"), name: "Limitada", password: "senha-correta-123" });
    const context = { ipAddress: "198.51.100.10" };

    for (let attempt = 1; attempt < 5; attempt += 1) {
      await expect(login({ email: user.email, password: "errada" }, context)).rejects.toBeInstanceOf(
        InvalidCredentialsError
      );
    }
    await expect(login({ email: user.email, password: "errada" }, context)).rejects.toBeInstanceOf(
      TooManyLoginAttemptsError
    );
    await expect(login({ email: user.email, password: "senha-correta-123" }, context)).rejects.toBeInstanceOf(
      TooManyLoginAttemptsError
    );
  });

  it("cadastro público responde igual para e-mail novo ou já cadastrado e avisa o dono", async () => {
    const delivery = { verificationDelivery: { baseUrl: "https://app.ax.finance" } };
    const email = uniqueEmail("signup");

    const first = await requestSignUp({ email, name: "Primeira", password: "senha-forte-123" }, delivery);
    expect(first.createdUser?.email).toBe(email);
    expect(await rootClient.outboxEvent.count({ where: { type: "EMAIL_VERIFICATION" } })).toBe(1);

    // Ainda não confirmado: nova tentativa reenvia a confirmação, sem criar outra conta nem trocar a senha.
    const again = await requestSignUp({ email, name: "Outra pessoa", password: "outra-senha-456" }, delivery);
    expect(again.createdUser).toBeNull();
    expect(await rootClient.user.count({ where: { email } })).toBe(1);
    expect(await rootClient.outboxEvent.count({ where: { type: "EMAIL_VERIFICATION" } })).toBe(2);

    // Confirmado: recebe o aviso "você já tem conta", no máximo um por hora.
    await rootClient.user.update({ where: { email }, data: { emailVerifiedAt: new Date() } });
    expect((await requestSignUp({ email, name: "X", password: "qualquer-senha-1" }, delivery)).createdUser).toBeNull();
    expect((await requestSignUp({ email, name: "X", password: "qualquer-senha-1" }, delivery)).createdUser).toBeNull();
    expect(await rootClient.outboxEvent.count({ where: { type: "ACCOUNT_EXISTS" } })).toBe(1);
    await expect(login({ email, password: "senha-forte-123" })).resolves.toMatchObject({ mfaRequired: false });
  });

  it("cadastro pelo site leva ao onboarding do plano escolhido ou ao convite", async () => {
    for (const returnTo of ["/onboarding?plano=PERSONAL", "/onboarding?plano=ESSENTIAL", "/convites/abc123"]) {
      const email = uniqueEmail("plano");
      const result = await requestSignUp({ email, name: "Ana", password: "senha-forte-123" }, { verificationDelivery: { baseUrl: "https://app.ax.finance", returnTo } });
      expect(result.createdUser?.email).toBe(email);
    }
    expect(await rootClient.outboxEvent.count({ where: { type: "EMAIL_VERIFICATION" } })).toBe(3);
    await expect(
      requestSignUp({ email: uniqueEmail("externo"), name: "Ana", password: "senha-forte-123" }, { verificationDelivery: { baseUrl: "https://app.ax.finance", returnTo: "//evil.example/x" } })
    ).rejects.toThrow();
  });

  it("conta falhas de login simultâneas sem perder nenhuma", async () => {
    const email = uniqueEmail("race");
    const results = await Promise.all(Array.from({ length: 12 }, () => recordLoginFailure(email, "198.51.100.20")));
    expect(results.some(Boolean)).toBe(true);
    const rows = await rootClient.loginRateLimit.findMany({ orderBy: { failedAttempts: "asc" } });
    expect(rows.map((row) => row.failedAttempts)).toEqual([12, 12]);
    // Só a chave do e-mail (limite 5) bloqueia; a do IP tem limite 20.
    expect(rows.filter((row) => row.blockedUntil && row.blockedUntil > new Date())).toHaveLength(1);

    // Janela vencida: a contagem recomeça do zero e o bloqueio sai.
    await rootClient.loginRateLimit.updateMany({ data: { windowStartedAt: new Date(Date.now() - 16 * 60 * 1000), blockedUntil: null } });
    expect(await recordLoginFailure(email, "198.51.100.20")).toBe(false);
    const reset = await rootClient.loginRateLimit.findMany();
    expect(reset.map((row) => row.failedAttempts)).toEqual([1, 1]);
  });

  it("e-mail sem conta também passa pela verificação de senha", async () => {
    const started = performance.now();
    await expect(login({ email: uniqueEmail("ghost"), password: "qualquer" })).rejects.toBeInstanceOf(InvalidCredentialsError);
    // scrypt leva dezenas de milissegundos; sem ele a resposta voltaria quase instantânea.
    expect(performance.now() - started).toBeGreaterThan(20);
  });
});
