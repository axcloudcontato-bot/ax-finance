import type { NextRequest } from "next/server";
import { login } from "@ax-finance/domain";
import { json, errorResponse } from "@/lib/api";
import { setSessionCookie } from "@/lib/session";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user, session } = await login(body);
    setSessionCookie(session.rawToken, session.expiresAt);
    return json({ id: user.id, email: user.email, name: user.name });
  } catch (error) {
    return errorResponse(error);
  }
}
