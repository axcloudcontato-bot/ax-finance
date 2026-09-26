import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

const SALT_LENGTH = 16;
const KEY_LENGTH = 64;

/**
 * scrypt (nativo do Node, sem dependência binária) em vez de argon2: evita
 * bundlers (Next/webpack) tropeçarem em addons .node específicos de
 * plataforma. scrypt é aceito pelo OWASP como alternativa quando argon2id
 * não está disponível.
 */
export async function hashPassword(plainPassword: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derivedKey = (await scrypt(plainPassword, salt, KEY_LENGTH)) as Buffer;
  return `scrypt:${salt.toString("hex")}:${derivedKey.toString("hex")}`;
}

export async function verifyPassword(
  plainPassword: string,
  passwordHash: string
): Promise<boolean> {
  const [scheme, saltHex, hashHex] = passwordHash.split(":");
  if (scheme !== "scrypt" || !saltHex || !hashHex) {
    return false;
  }

  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const derivedKey = (await scrypt(plainPassword, salt, expected.length)) as Buffer;

  if (derivedKey.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(derivedKey, expected);
}
