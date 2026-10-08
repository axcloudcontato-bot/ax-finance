import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { registerUser } from "../identity/register";
import { login } from "../identity/login";
import { beginMfaSetup, completeMfaChallenge, confirmMfaSetup, disableMfa, generateTotpCode } from "../identity/mfa";
import { listTrustedDevices, revokeAllTrustedDevices, revokeTrustedDevice } from "../identity/trusted-devices";
import { rootClient, resetDatabase } from "./test-db";

const PASSWORD = "senha-forte-123";

beforeEach(async () => resetDatabase());
afterAll(async () => rootClient.$disconnect());

async function userWithMfa() {
  const user = await registerUser({ email: `td.${randomUUID()}@teste.ax.finance`, name: "Confiável", password: PASSWORD });
  const setup = await beginMfaSetup(user.id);
  const { recoveryCodes } = await confirmMfaSetup(user.id, generateTotpCode(setup.secret));
  return { user, secret: setup.secret, recoveryCodes };
}

async function trustThisDevice(email: string, code: string) {
  const first = await login({ email, password: PASSWORD });
  if (!first.mfaRequired) throw new Error("Desafio MFA esperado");
  const done = await completeMfaChallenge(first.challenge.rawToken, code, { trustDevice: { label: "Chrome em Windows" } });
  if (!done.trustedDevice) throw new Error("Dispositivo confiável esperado");
  return done.trustedDevice.rawToken;
}

describe("dispositivos confiáveis (2FA)", () => {
  it("sem marcar a opção, o próximo login continua pedindo o código", async () => {
    const { user, recoveryCodes } = await userWithMfa();
    const first = await login({ email: user.email, password: PASSWORD });
    if (!first.mfaRequired) throw new Error("Desafio MFA esperado");
    const done = await completeMfaChallenge(first.challenge.rawToken, recoveryCodes[0]!);
    expect(done.trustedDevice).toBeUndefined();
    expect((await login({ email: user.email, password: PASSWORD })).mfaRequired).toBe(true);
  });

  it("marcando a opção, o login seguinte desse dispositivo entra só com a senha", async () => {
    const { user, recoveryCodes } = await userWithMfa();
    const token = await trustThisDevice(user.email, recoveryCodes[0]!);

    const next = await login({ email: user.email, password: PASSWORD }, { trustedDeviceToken: token });
    expect(next.mfaRequired).toBe(false);
    if (next.mfaRequired) throw new Error("login direto esperado");
    expect(next.session.rawToken).toBeTruthy();

    // outro dispositivo (sem o token) ou token inventado continuam pedindo o código
    expect((await login({ email: user.email, password: PASSWORD })).mfaRequired).toBe(true);
    expect((await login({ email: user.email, password: PASSWORD }, { trustedDeviceToken: "token-inventado" })).mfaRequired).toBe(true);
    // a senha continua sendo exigida
    await expect(login({ email: user.email, password: "senha-errada-123" }, { trustedDeviceToken: token })).rejects.toThrow();
  });

  it("o token de um usuário não vale para outro", async () => {
    const first = await userWithMfa();
    const token = await trustThisDevice(first.user.email, first.recoveryCodes[0]!);
    const second = await userWithMfa();
    expect((await login({ email: second.user.email, password: PASSWORD }, { trustedDeviceToken: token })).mfaRequired).toBe(true);
  });

  it("dispositivo expirado ou removido volta a pedir o código", async () => {
    const { user, recoveryCodes } = await userWithMfa();
    const token = await trustThisDevice(user.email, recoveryCodes[0]!);
    const [device] = await listTrustedDevices(user.id);
    expect(device?.label).toBe("Chrome em Windows");

    await rootClient.trustedDevice.update({ where: { id: device!.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await login({ email: user.email, password: PASSWORD }, { trustedDeviceToken: token })).mfaRequired).toBe(true);
    expect(await listTrustedDevices(user.id)).toHaveLength(0);

    const again = await trustThisDevice(user.email, recoveryCodes[1]!);
    const [fresh] = await listTrustedDevices(user.id);
    await revokeTrustedDevice(user.id, fresh!.id);
    expect((await login({ email: user.email, password: PASSWORD }, { trustedDeviceToken: again })).mfaRequired).toBe(true);
  });

  it("remover todos, desativar e reativar a proteção revogam os dispositivos", async () => {
    const { user, recoveryCodes } = await userWithMfa();
    const token = await trustThisDevice(user.email, recoveryCodes[0]!);
    await revokeAllTrustedDevices(user.id);
    expect((await login({ email: user.email, password: PASSWORD }, { trustedDeviceToken: token })).mfaRequired).toBe(true);

    const second = await trustThisDevice(user.email, recoveryCodes[1]!);
    await disableMfa(user.id, PASSWORD, recoveryCodes[2]!);
    const setup = await beginMfaSetup(user.id);
    await confirmMfaSetup(user.id, generateTotpCode(setup.secret));
    expect((await login({ email: user.email, password: PASSWORD }, { trustedDeviceToken: second })).mfaRequired).toBe(true);
  });
});
