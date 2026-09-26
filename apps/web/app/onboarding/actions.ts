"use server";

import { redirect } from "next/navigation";
import { createCompany, createFinancialAccount, seedDefaultCategories } from "@ax-finance/domain";
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
    const company = await createCompany(user.id, { name: companyName });

    await createFinancialAccount(user.id, company.id, {
      name: accountName,
      type: accountType,
      openingBalanceCents: parseAmountToCents(openingBalanceRaw),
      openingDate,
    });

    await seedDefaultCategories(user.id, company.id);

    companyId = company.id;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível concluir.";
    redirect(`/onboarding?erro=${encodeURIComponent(message)}`);
  }

  redirect(`/dashboard?empresa=${companyId}`);
}
