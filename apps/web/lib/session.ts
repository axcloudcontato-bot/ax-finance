import { cookies } from "next/headers";
import { NotAuthenticatedError, resolveSession } from "@ax-finance/domain";

export const SESSION_COOKIE_NAME = "ax_session";
export const MFA_CHALLENGE_COOKIE_NAME = "ax_mfa_challenge";
export const TRUSTED_DEVICE_COOKIE_NAME = "ax_trusted_device";

/**
 * Só pode ser chamada em Server Components (leitura) — para gravar o cookie,
 * use `setSessionCookie`/`clearSessionCookie` a partir de uma Server Action
 * ou Route Handler, únicos lugares onde o Next permite mutar cookies.
 */
export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await resolveSession(token);
  return session?.user ?? null;
}

export async function setSessionCookie(rawToken: string, expiresAt?: Date) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    // Cookie "Secure" só é aceito pelo navegador em HTTPS — em produção sem
    // TLS na frente (ex.: acesso direto por IP, atrás de um proxy que ainda
    // não termina TLS), o navegador descarta o cookie e a sessão nunca
    // persiste. COOKIE_SECURE=false permite destravar esse caso; o padrão
    // continua seguro (true) assim que houver HTTPS.
    secure: process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function setMfaChallengeCookie(rawToken: string, expiresAt: Date) {
  const cookieStore = await cookies();
  cookieStore.set(MFA_CHALLENGE_COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
}

export async function getMfaChallengeToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(MFA_CHALLENGE_COOKIE_NAME)?.value;
}

export async function clearMfaChallengeCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(MFA_CHALLENGE_COOKIE_NAME);
}

/** Dispositivo confiável: o cookie dura mais que a sessão e só dispensa o código em duas etapas no login. */
export async function setTrustedDeviceCookie(rawToken: string, expiresAt: Date) {
  const cookieStore = await cookies();
  cookieStore.set(TRUSTED_DEVICE_COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
}

export async function getTrustedDeviceToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(TRUSTED_DEVICE_COOKIE_NAME)?.value;
}

export async function clearTrustedDeviceCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(TRUSTED_DEVICE_COOKIE_NAME);
}

export async function getSessionToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value;
}

/** Para Route Handlers: lança em vez de devolver null, para os handlers só terem o caminho feliz. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    throw new NotAuthenticatedError();
  }
  return user;
}
