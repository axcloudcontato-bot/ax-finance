import { cookies } from "next/headers";
import { NotAuthenticatedError, resolveSession } from "@ax-finance/domain";

export const SESSION_COOKIE_NAME = "ax_session";

/**
 * Só pode ser chamada em Server Components (leitura) — para gravar o cookie,
 * use `setSessionCookie`/`clearSessionCookie` a partir de uma Server Action
 * ou Route Handler, únicos lugares onde o Next permite mutar cookies.
 */
export async function getCurrentUser() {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await resolveSession(token);
  return session?.user ?? null;
}

export function setSessionCookie(rawToken: string, expiresAt: Date) {
  cookies().set(SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
}

export function clearSessionCookie() {
  cookies().delete(SESSION_COOKIE_NAME);
}

export function getSessionToken(): string | undefined {
  return cookies().get(SESSION_COOKIE_NAME)?.value;
}

/** Para Route Handlers: lança em vez de devolver null, para os handlers só terem o caminho feliz. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    throw new NotAuthenticatedError();
  }
  return user;
}
