"use server";

import { redirect } from "next/navigation";
import { closePeriod, reopenPeriod } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";

export async function closePeriodAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const company = await requirePrimaryCompany(user.id);

  const period = String(formData.get("period") ?? "");

  try {
    await closePeriod(user.id, company.id, { period });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível fechar o período.";
    redirect(`/fechamento?erro=${encodeURIComponent(message)}`);
  }

  redirect(`/fechamento?fechado=${period}`);
}

export async function reopenPeriodAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const company = await requirePrimaryCompany(user.id);

  const period = String(formData.get("period") ?? "");
  const reason = String(formData.get("reason") ?? "");

  try {
    await reopenPeriod(user.id, company.id, { period, reason });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível reabrir o período.";
    redirect(`/fechamento?erro=${encodeURIComponent(message)}`);
  }

  redirect(`/fechamento?reaberto=${period}`);
}
