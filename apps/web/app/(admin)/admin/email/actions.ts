"use server";

import { redirect } from "next/navigation";
import { sendSmtpTestEmail, updateSmtpSettings } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { actionErrorMessage } from "@/lib/action-errors";

async function actor() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

const text = (formData: FormData, name: string) => String(formData.get(name) ?? "");

export async function saveSmtpSettingsAction(formData: FormData) {
  const user = await actor();
  try {
    await updateSmtpSettings(user.id, {
      enabled: formData.get("enabled") === "on",
      host: text(formData, "host"),
      port: text(formData, "port"),
      security: text(formData, "security"),
      username: text(formData, "username"),
      password: text(formData, "password"),
      clearPassword: formData.get("clearPassword") === "on",
      fromName: text(formData, "fromName"),
      fromEmail: text(formData, "fromEmail"),
    });
  } catch (error) {
    redirect(`/admin/email?erro=${encodeURIComponent(actionErrorMessage(error, "Não foi possível salvar a configuração."))}`);
  }
  redirect("/admin/email?salvo=1");
}

export async function sendSmtpTestAction() {
  const user = await actor();
  let to: string;
  try {
    ({ to } = await sendSmtpTestEmail(user.id));
  } catch (error) {
    redirect(`/admin/email?erroTeste=${encodeURIComponent(actionErrorMessage(error, "Não foi possível enviar o teste."))}`);
  }
  redirect(`/admin/email?testado=${encodeURIComponent(to)}`);
}
