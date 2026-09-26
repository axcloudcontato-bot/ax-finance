"use server";

import { redirect } from "next/navigation";
import { completeOnboarding } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { parseAmountToCents } from "@/lib/currency";

export async function onboardingAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const companyName = String(formData.get("companyName") ?? "");
  const accountName = String(formData.get("accountName") ?? "");
  const accountType = String(formData.get("accountType") ?? "BANK") as
    | "BANK"
    | "CASH"
    | "WALLET";
  const openingBalanceRaw = String(formData.get("openingBalance") ?? "0");
  const openingDate = String(formData.get("openingDate") ?? "");

  let companyId: string;

  try {
    // Empresa + conta + categorias padrão numa única transação — ver
    // complete-onboarding.ts para o motivo (evita empresa órfã sem conta se
    // um passo do meio falhar).
    const { company } = await completeOnboarding(user.id, {
      companyName,
      accountName,
      accountType,
      openingBalanceCents: parseAmountToCents(openingBalanceRaw),
      openingDate,
    });
    companyId = company.id;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível concluir.";
    redirect(`/onboarding?erro=${encodeURIComponent(message)}`);
  }

  redirect(`/dashboard?empresa=${companyId}`);
}
