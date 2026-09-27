import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { registerUser } from "../identity/register";
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
});
