"use server";

import { redirect } from "next/navigation";
import { revokeSession } from "@ax-finance/domain";
import { clearMfaChallengeCookie, clearSessionCookie, getSessionToken } from "@/lib/session";

export async function logoutAction() {
  const token = await getSessionToken();
  if (token) {
    await revokeSession(token);
  }
  await clearSessionCookie();
  await clearMfaChallengeCookie();
  redirect("/login");
}
