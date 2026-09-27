import type { NextRequest } from "next/server";
import { issueEmailVerificationToken, registerUser } from "@ax-finance/domain";
import { json, errorResponse } from "@/lib/api";
import { sendVerificationEmail } from "@/lib/email";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const user = await registerUser(body, { requireEmailVerification: true });
    const verification = await issueEmailVerificationToken(user.id);
    let verificationEmailSent = false;
    if (verification) {
      try {
        const delivery = await sendVerificationEmail({
          to: user.email,
          name: user.name,
          rawToken: verification.rawToken,
          fallbackOrigin: request.nextUrl.origin,
        });
        verificationEmailSent = delivery.delivered;
      } catch (error) {
        console.error("Falha ao enviar verificação de e-mail", error);
      }
    }
    return json({ id: user.id, email: user.email, name: user.name, verificationEmailSent }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
