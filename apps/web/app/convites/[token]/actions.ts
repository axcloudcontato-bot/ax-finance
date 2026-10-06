"use server";

import { redirect } from "next/navigation";
import { acceptCompanyInvitation } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { actionErrorMessage } from "@/lib/action-errors";

export async function acceptInvitationAction(token: string) {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?retorno=${encodeURIComponent(`/convites/${token}`)}`);
  }
  try {
    await acceptCompanyInvitation(user.id, token);
  } catch (error) {
    redirect(`/convites/${token}?erro=${encodeURIComponent(actionErrorMessage(error, "Não foi possível aceitar o convite."))}`);
  }
  redirect("/dashboard?conviteAceito=1");
}
