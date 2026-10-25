"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { requestSignUp } from "@ax-finance/domain";
import { ZodError } from "zod";
import { publicBaseUrl, verificationPreviewPath } from "@/lib/email";
import { actionErrorMessage } from "@/lib/action-errors";

export type RegisterField = "name" | "email" | "password";

/** Volta para o formulário sem redirecionar: o nome e o e-mail continuam preenchidos (fora da URL). */
export type RegisterState = {
  error?: string;
  field?: RegisterField;
  name?: string;
  email?: string;
};

/** O navegador aceita formatos que o servidor recusa (sem ".com", com acento) e o preenchimento
    automático pula o mínimo da senha: a mensagem diz qual campo corrigir. */
function signUpValidationMessage(error: ZodError): { field?: RegisterField; message: string } {
  const issue = error.issues[0];
  const field = issue?.path[0];
  if (field === "email") return { field, message: "Confira o e-mail: use o formato nome@exemplo.com.br, sem acentos nem espaços." };
  if (field === "name") return { field, message: "Informe seu nome." };
  if (field === "password") {
    return issue?.code === "too_big"
      ? { field, message: "A senha pode ter no máximo 200 caracteres." }
      : { field, message: "A senha precisa ter pelo menos 8 caracteres." };
  }
  return { message: "Verifique o e-mail, nome e senha (mínimo 8 caracteres)." };
}

export async function registerAction(_previous: RegisterState, formData: FormData): Promise<RegisterState> {
  const email = String(formData.get("email") ?? "");
  const name = String(formData.get("name") ?? "");
  const password = String(formData.get("password") ?? "");
  const requestedReturnTo = String(formData.get("returnTo") ?? "");
  const planCode = String(formData.get("planCode") ?? "ESSENTIAL").toUpperCase() === "PERSONAL" ? "PERSONAL" : "ESSENTIAL";
  const returnTo = requestedReturnTo.startsWith("/convites/")
    ? requestedReturnTo
    : `/onboarding?plano=${planCode}`;

  // Mesma resposta para e-mail novo ou já cadastrado (não revela quem tem conta).
  let user;
  try {
    const requestHeaders = await headers();
    ({ createdUser: user } = await requestSignUp(
      { email, name, password },
      {
        verificationDelivery: {
          baseUrl: publicBaseUrl(requestHeaders.get("origin") ?? undefined),
          returnTo: returnTo || undefined,
        },
      }
    ));
  } catch (error) {
    if (error instanceof ZodError) {
      const { field, message } = signUpValidationMessage(error);
      return { error: message, field, name, email };
    }
    return { error: actionErrorMessage(error, "Não foi possível concluir o cadastro."), name, email };
  }

  const previewPath = user?.verification
    ? verificationPreviewPath(user.verification.rawToken, returnTo || undefined)
    : undefined;

  redirect(`/login?cadastrado=1&verificacao=pendente${returnTo ? `&retorno=${encodeURIComponent(returnTo)}` : ""}${previewPath ? `&preview=${encodeURIComponent(previewPath)}` : ""}`);
}
