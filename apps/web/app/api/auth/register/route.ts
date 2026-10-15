import type { NextRequest } from "next/server";
import { requestSignUp } from "@ax-finance/domain";
import { json, errorResponse } from "@/lib/api";
import { publicBaseUrl } from "@/lib/email";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // 202 com a mesma resposta para e-mail novo ou já cadastrado: não revela quem tem conta.
    await requestSignUp(body, {
      verificationDelivery: { baseUrl: publicBaseUrl(request.nextUrl.origin) },
    });
    return json({ message: "Se o e-mail puder ser usado, enviamos as instruções para continuar." }, 202);
  } catch (error) {
    return errorResponse(error);
  }
}
