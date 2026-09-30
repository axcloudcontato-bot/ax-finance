const AUTH_RETURN_ORIGIN = "https://ax-finance.internal";

export function safeAuthReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return "/";
  }

  try {
    const target = new URL(value, AUTH_RETURN_ORIGIN);
    if (target.origin !== AUTH_RETURN_ORIGIN) return "/";

    const allowed =
      target.pathname === "/admin" ||
      target.pathname.startsWith("/admin/") ||
      target.pathname === "/onboarding" ||
      target.pathname.startsWith("/convites/");

    return allowed ? `${target.pathname}${target.search}${target.hash}` : "/";
  } catch {
    return "/";
  }
}

export function loginPathFor(returnTo: string): string {
  const safeReturnTo = safeAuthReturnTo(returnTo);
  return safeReturnTo === "/"
    ? "/login"
    : `/login?retorno=${encodeURIComponent(safeReturnTo)}`;
}
