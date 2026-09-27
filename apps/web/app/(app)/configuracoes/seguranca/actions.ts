"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { beginMfaSetup, confirmMfaSetup, disableMfa } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";

export interface ConfirmMfaState {
  error?: string;
  recoveryCodes?: string[];
}

export async function beginMfaSetupAction() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  try {
    await beginMfaSetup(user.id);
  } catch (error) {
    redirect(`/configuracoes/seguranca?erro=${encodeURIComponent(error instanceof Error ? error.message : "Não foi possível iniciar a configuração.")}`);
  }
  redirect("/configuracoes/seguranca?configurando=1");
}

export async function confirmMfaSetupAction(
  _previousState: ConfirmMfaState,
  formData: FormData
): Promise<ConfirmMfaState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sua sessão expirou. Entre novamente." };
  try {
    const result = await confirmMfaSetup(user.id, String(formData.get("code") ?? ""));
    revalidatePath("/configuracoes/seguranca");
    return { recoveryCodes: result.recoveryCodes };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível confirmar o código." };
  }
}

export async function disableMfaAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  try {
    await disableMfa(
      user.id,
      String(formData.get("password") ?? ""),
      String(formData.get("code") ?? "")
    );
  } catch (error) {
    redirect(`/configuracoes/seguranca?erro=${encodeURIComponent(error instanceof Error ? error.message : "Não foi possível desativar a proteção.")}`);
  }
  revalidatePath("/configuracoes/seguranca");
  redirect("/configuracoes/seguranca?desativado=1");
}
