import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { Prisma, prisma } from "@ax-finance/db";
import {
  InvalidCredentialsError,
  InvalidMfaCodeError,
  MfaAlreadyEnabledError,
  MfaChallengeInvalidError,
  MfaConfigurationError,
  MfaNotEnabledError,
  TooManyLoginAttemptsError,
} from "../errors";
import { verifyPassword } from "./password";
import { createSessionWithClient, type CreatedSession } from "./session";

const TOTP_STEP_SECONDS = 30;
const TOTP_DIGITS = 6;
const SETUP_TTL_MS = 10 * 60 * 1000;
const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const MAX_CHALLENGE_ATTEMPTS = 5;
const MFA_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function encryptionKey(): Buffer {
  const configured = process.env.MFA_ENCRYPTION_KEY ?? process.env.SESSION_SECRET;
  if (!configured) {
    if (process.env.NODE_ENV === "production") throw new MfaConfigurationError();
    return createHash("sha256").update("ax-finance-local-mfa-key").digest();
  }
  if (/^[a-f\d]{64}$/i.test(configured)) return Buffer.from(configured, "hex");
  return createHash("sha256").update(configured).digest();
}

function encryptSecret(secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return `v1:${iv.toString("base64url")}:${cipher.getAuthTag().toString("base64url")}:${encrypted.toString("base64url")}`;
}

function decryptSecret(value: string): string {
  try {
    const [version, iv, tag, encrypted] = value.split(":");
    if (version !== "v1" || !iv || !tag || !encrypted) throw new Error("invalid ciphertext");
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(encrypted, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch (error) {
    if (error instanceof MfaConfigurationError) throw error;
    throw new MfaConfigurationError();
  }
}

export function encodeBase32(buffer: Buffer): string {
  let bits = "";
  for (const byte of buffer) bits += byte.toString(2).padStart(8, "0");
  let output = "";
  for (let index = 0; index < bits.length; index += 5) {
    output += BASE32_ALPHABET[Number.parseInt(bits.slice(index, index + 5).padEnd(5, "0"), 2)];
  }
  return output;
}

function decodeBase32(value: string): Buffer {
  let bits = "";
  for (const character of value.replace(/=+$/g, "").replace(/\s/g, "").toUpperCase()) {
    const index = BASE32_ALPHABET.indexOf(character);
    if (index < 0) throw new InvalidMfaCodeError();
    bits += index.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }
  return Buffer.from(bytes);
}

export function generateTotpCode(secret: string, at = new Date()): string {
  const counter = BigInt(Math.floor(at.getTime() / 1000 / TOTP_STEP_SECONDS));
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(counter);
  const digest = createHmac("sha1", decodeBase32(secret)).update(buffer).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const value = (digest.readUInt32BE(offset) & 0x7fffffff) % 10 ** TOTP_DIGITS;
  return value.toString().padStart(TOTP_DIGITS, "0");
}

function matchTotpCounter(secret: string, code: string, now = new Date()): bigint | null {
  const normalized = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(normalized)) return null;
  const current = Math.floor(now.getTime() / 1000 / TOTP_STEP_SECONDS);
  for (const offset of [-1, 0, 1]) {
    const at = new Date((current + offset) * TOTP_STEP_SECONDS * 1000);
    const expected = Buffer.from(generateTotpCode(secret, at));
    const supplied = Buffer.from(normalized);
    if (expected.length === supplied.length && timingSafeEqual(expected, supplied)) {
      return BigInt(current + offset);
    }
  }
  return null;
}

function tokenHash(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

function normalizeRecoveryCode(code: string): string {
  return code.replace(/[^a-z\d]/gi, "").toUpperCase();
}

function recoveryCodeHash(userId: string, code: string): string {
  return createHash("sha256").update(`${userId}:${normalizeRecoveryCode(code)}`).digest("hex");
}

function recoveryHashes(value: unknown): string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : [];
}

function createRecoveryCodes(userId: string) {
  const codes = Array.from({ length: 8 }, () => {
    const value = randomBytes(8).toString("hex").toUpperCase();
    return value.match(/.{1,4}/g)!.join("-");
  });
  return { codes, hashes: codes.map((code) => recoveryCodeHash(userId, code)) };
}

function provisioningDetails(email: string, secret: string) {
  const issuer = "AX Finance";
  const label = `${issuer}:${email}`;
  return {
    secret,
    otpauthUri: `otpauth://totp/${encodeURIComponent(label)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_STEP_SECONDS}`,
  };
}

export async function getMfaStatus(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { mfaEnabledAt: true, mfaRecoveryCodeHashes: true },
  });
  return {
    enabled: Boolean(user?.mfaEnabledAt),
    enabledAt: user?.mfaEnabledAt ?? null,
    recoveryCodesRemaining: recoveryHashes(user?.mfaRecoveryCodeHashes).length,
  };
}

export async function beginMfaSetup(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new InvalidCredentialsError();
  if (user.mfaEnabledAt) throw new MfaAlreadyEnabledError();

  const secret = encodeBase32(randomBytes(20));
  const expiresAt = new Date(Date.now() + SETUP_TTL_MS);
  const secretEncrypted = encryptSecret(secret);
  await prisma.mfaSetup.upsert({
    where: { userId },
    create: { userId, secretEncrypted, expiresAt },
    update: { secretEncrypted, expiresAt, createdAt: new Date() },
  });
  return { ...provisioningDetails(user.email, secret), expiresAt };
}

export async function getPendingMfaSetup(userId: string) {
  const setup = await prisma.mfaSetup.findUnique({
    where: { userId },
    include: { user: { select: { email: true, mfaEnabledAt: true } } },
  });
  if (!setup || setup.user.mfaEnabledAt || setup.expiresAt <= new Date()) return null;
  const secret = decryptSecret(setup.secretEncrypted);
  return { ...provisioningDetails(setup.user.email, secret), expiresAt: setup.expiresAt };
}

export async function confirmMfaSetup(userId: string, code: string) {
  const setup = await prisma.mfaSetup.findUnique({ where: { userId }, include: { user: true } });
  if (!setup || setup.expiresAt <= new Date()) throw new MfaChallengeInvalidError();
  if (setup.user.mfaEnabledAt) throw new MfaAlreadyEnabledError();
  const secret = decryptSecret(setup.secretEncrypted);
  if (matchTotpCounter(secret, code) === null) throw new InvalidMfaCodeError();
  const recovery = createRecoveryCodes(userId);
  const enabledAt = new Date();

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        mfaSecretEncrypted: setup.secretEncrypted,
        mfaEnabledAt: enabledAt,
        mfaRecoveryCodeHashes: recovery.hashes,
        mfaLastUsedCounter: null,
      },
    }),
    prisma.mfaSetup.delete({ where: { userId } }),
    prisma.mfaChallenge.updateMany({
      where: { userId, consumedAt: null },
      data: { consumedAt: enabledAt },
    }),
  ]);
  return { enabledAt, recoveryCodes: recovery.codes };
}

export async function createMfaChallenge(userId: string, rememberSession: boolean) {
  const recentFailures = await prisma.mfaChallenge.aggregate({
    where: { userId, createdAt: { gte: new Date(Date.now() - MFA_ATTEMPT_WINDOW_MS) } },
    _sum: { failedAttempts: true },
  });
  if ((recentFailures._sum.failedAttempts ?? 0) >= MAX_CHALLENGE_ATTEMPTS) {
    throw new TooManyLoginAttemptsError();
  }
  const rawToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);
  await prisma.$transaction([
    prisma.mfaChallenge.updateMany({
      where: { userId, consumedAt: null },
      data: { consumedAt: new Date() },
    }),
    prisma.mfaChallenge.create({
      data: { userId, tokenHash: tokenHash(rawToken), rememberSession, expiresAt },
    }),
  ]);
  return { rawToken, expiresAt };
}

type ChallengeResult =
  | { kind: "success"; session: CreatedSession; rememberSession: boolean }
  | { kind: "invalid-code" }
  | { kind: "invalid-challenge" };

export async function completeMfaChallenge(rawToken: string, code: string) {
  const result: ChallengeResult = await prisma.$transaction(async (tx) => {
    const challenge = await tx.mfaChallenge.findUnique({
      where: { tokenHash: tokenHash(rawToken) },
      include: { user: true },
    });
    const now = new Date();
    if (
      !challenge || challenge.consumedAt || challenge.expiresAt <= now ||
      challenge.failedAttempts >= MAX_CHALLENGE_ATTEMPTS || challenge.user.status !== "ACTIVE" ||
      !challenge.user.mfaEnabledAt || !challenge.user.mfaSecretEncrypted
    ) return { kind: "invalid-challenge" };

    const secret = decryptSecret(challenge.user.mfaSecretEncrypted);
    const counter = matchTotpCounter(secret, code, now);
    const storedRecoveryHashes = recoveryHashes(challenge.user.mfaRecoveryCodeHashes);
    const suppliedRecoveryHash = recoveryCodeHash(challenge.userId, code);
    const recoveryIndex = storedRecoveryHashes.indexOf(suppliedRecoveryHash);
    const totpValid = counter !== null &&
      (challenge.user.mfaLastUsedCounter === null || counter > challenge.user.mfaLastUsedCounter);
    const recoveryValid = recoveryIndex >= 0;

    if (!totpValid && !recoveryValid) {
      const failedAttempts = challenge.failedAttempts + 1;
      const updated = await tx.mfaChallenge.updateMany({
        where: { id: challenge.id, consumedAt: null, failedAttempts: challenge.failedAttempts },
        data: {
          failedAttempts,
          consumedAt: failedAttempts >= MAX_CHALLENGE_ATTEMPTS ? now : null,
        },
      });
      return updated.count === 1 ? { kind: "invalid-code" } : { kind: "invalid-challenge" };
    }

    // Reivindica o desafio de forma atômica antes de criar a sessão. Assim,
    // duas requisições simultâneas com o mesmo código não autenticam duas vezes.
    const claimed = await tx.mfaChallenge.updateMany({
      where: { id: challenge.id, consumedAt: null, failedAttempts: challenge.failedAttempts },
      data: { consumedAt: now },
    });
    if (claimed.count !== 1) return { kind: "invalid-challenge" };

    await tx.user.update({
      where: { id: challenge.userId },
      data: totpValid
        ? { mfaLastUsedCounter: counter }
        : { mfaRecoveryCodeHashes: storedRecoveryHashes.filter((_, index) => index !== recoveryIndex) },
    });
    const session = await createSessionWithClient(tx, challenge.userId);
    return { kind: "success", session, rememberSession: challenge.rememberSession };
  });

  if (result.kind === "invalid-challenge") throw new MfaChallengeInvalidError();
  if (result.kind === "invalid-code") throw new InvalidMfaCodeError();
  return result;
}

export async function disableMfa(userId: string, password: string, code: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.mfaEnabledAt || !user.mfaSecretEncrypted) throw new MfaNotEnabledError();
  if (!(await verifyPassword(password, user.passwordHash))) throw new InvalidCredentialsError();

  const counter = matchTotpCounter(decryptSecret(user.mfaSecretEncrypted), code);
  const hashes = recoveryHashes(user.mfaRecoveryCodeHashes);
  const recoveryValid = hashes.includes(recoveryCodeHash(userId, code));
  const totpValid = counter !== null &&
    (user.mfaLastUsedCounter === null || counter > user.mfaLastUsedCounter);
  if (!totpValid && !recoveryValid) throw new InvalidMfaCodeError();

  const now = new Date();
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        mfaSecretEncrypted: null,
        mfaEnabledAt: null,
        mfaRecoveryCodeHashes: Prisma.DbNull,
        mfaLastUsedCounter: null,
      },
    }),
    prisma.mfaSetup.deleteMany({ where: { userId } }),
    prisma.mfaChallenge.updateMany({ where: { userId, consumedAt: null }, data: { consumedAt: now } }),
  ]);
}
