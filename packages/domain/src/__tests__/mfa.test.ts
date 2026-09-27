import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { registerUser } from "../identity/register";
import { login } from "../identity/login";
import {
  beginMfaSetup,
  completeMfaChallenge,
  confirmMfaSetup,
  disableMfa,
  generateTotpCode,
  getMfaStatus,
} from "../identity/mfa";
import { InvalidMfaCodeError, MfaChallengeInvalidError, TooManyLoginAttemptsError } from "../errors";
import { rootClient, resetDatabase } from "./test-db";

function uniqueEmail() {
  return `mfa.${randomUUID()}@teste.ax.finance`;
}

beforeEach(async () => resetDatabase());
afterAll(async () => rootClient.$disconnect());

describe("autenticação em duas etapas", () => {
  it("ativa TOTP, exige desafio no login e impede repetição do código", async () => {
    const user = await registerUser({ email: uniqueEmail(), name: "MFA", password: "senha-forte-123" });
    const setup = await beginMfaSetup(user.id);
    const code = generateTotpCode(setup.secret);
    const enabled = await confirmMfaSetup(user.id, code);

    expect(enabled.recoveryCodes).toHaveLength(8);
    const stored = await rootClient.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.mfaSecretEncrypted).not.toContain(setup.secret);
    expect(JSON.stringify(stored.mfaRecoveryCodeHashes)).not.toContain(enabled.recoveryCodes[0]);

    const firstLogin = await login({ email: user.email, password: "senha-forte-123" });
    expect(firstLogin.mfaRequired).toBe(true);
    if (!firstLogin.mfaRequired) throw new Error("Desafio MFA esperado");
    const completed = await completeMfaChallenge(firstLogin.challenge.rawToken, code);
    expect(completed.session.rawToken).toBeTruthy();

    const replayLogin = await login({ email: user.email, password: "senha-forte-123" });
    if (!replayLogin.mfaRequired) throw new Error("Desafio MFA esperado");
    await expect(completeMfaChallenge(replayLogin.challenge.rawToken, code)).rejects.toBeInstanceOf(
      InvalidMfaCodeError
    );
  });

  it("consome códigos de recuperação uma única vez", async () => {
    const user = await registerUser({ email: uniqueEmail(), name: "Recovery", password: "senha-forte-123" });
    const setup = await beginMfaSetup(user.id);
    const { recoveryCodes } = await confirmMfaSetup(user.id, generateTotpCode(setup.secret));

    const first = await login({ email: user.email, password: "senha-forte-123" });
    if (!first.mfaRequired) throw new Error("Desafio MFA esperado");
    await expect(completeMfaChallenge(first.challenge.rawToken, recoveryCodes[0]!)).resolves.toHaveProperty("session.rawToken");

    const second = await login({ email: user.email, password: "senha-forte-123" });
    if (!second.mfaRequired) throw new Error("Desafio MFA esperado");
    await expect(completeMfaChallenge(second.challenge.rawToken, recoveryCodes[0]!)).rejects.toBeInstanceOf(
      InvalidMfaCodeError
    );
    expect((await getMfaStatus(user.id)).recoveryCodesRemaining).toBe(7);
  });

  it("invalida o desafio após cinco erros e permite desativar com confirmação", async () => {
    const user = await registerUser({ email: uniqueEmail(), name: "Limite MFA", password: "senha-forte-123" });
    const setup = await beginMfaSetup(user.id);
    const { recoveryCodes } = await confirmMfaSetup(user.id, generateTotpCode(setup.secret));
    const result = await login({ email: user.email, password: "senha-forte-123" });
    if (!result.mfaRequired) throw new Error("Desafio MFA esperado");

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(completeMfaChallenge(result.challenge.rawToken, "codigo-invalido")).rejects.toBeInstanceOf(
        InvalidMfaCodeError
      );
    }
    await expect(completeMfaChallenge(result.challenge.rawToken, "codigo-invalido")).rejects.toBeInstanceOf(
      MfaChallengeInvalidError
    );
    await expect(login({ email: user.email, password: "senha-forte-123" })).rejects.toBeInstanceOf(
      TooManyLoginAttemptsError
    );

    await disableMfa(user.id, "senha-forte-123", recoveryCodes[1]!);
    expect((await getMfaStatus(user.id)).enabled).toBe(false);
    await expect(login({ email: user.email, password: "senha-forte-123" })).resolves.toMatchObject({
      mfaRequired: false,
    });
  });
});
