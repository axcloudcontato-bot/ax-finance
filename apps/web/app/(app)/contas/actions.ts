"use server";

import { redirect } from "next/navigation";
import { createFinancialAccount } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { parseAmountToCents } from "@/lib/currency";

export async function createAccountAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const company = await requirePrimaryCompany(user.id);

  const name = String(formData.get("name") ?? "");
  const type = String(formData.get("type") ?? "BANK") as "BANK" | "CASH" | "WALLET";
  const openingBalance = String(formData.get("openingBalance") ?? "0");
  const openingDate = String(formData.get("openingDate") ?? "");

  try {
    await createFinancialAccount(user.id, company.id, {
      name,
      type,
      openingBalanceCents: parseAmountToCents(openingBalance),
      openingDate,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível criar a conta.";
    redirect(`/contas?erro=${encodeURIComponent(message)}`);
  }

  redirect("/contas");
}
