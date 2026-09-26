"use server";

import { redirect } from "next/navigation";
import { revokeSession } from "@ax-finance/domain";
import { clearSessionCookie, getSessionToken } from "@/lib/session";

export async function logoutAction() {
  const token = getSessionToken();
  if (token) {
    await revokeSession(token);
  }
  clearSessionCookie();
  redirect("/login");
}
