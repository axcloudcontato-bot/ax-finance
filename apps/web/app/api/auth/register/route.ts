import type { NextRequest } from "next/server";
import { registerUser } from "@ax-finance/domain";
import { json, errorResponse } from "@/lib/api";
import { publicBaseUrl } from "@/lib/email";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const user = await registerUser(body, {
      requireEmailVerification: true,
      verificationDelivery: { baseUrl: publicBaseUrl(request.nextUrl.origin) },
    });
    return json({
      id: user.id,
      email: user.email,
      name: user.name,
      verificationEmailQueued: Boolean(user.verification?.queued),
    }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
