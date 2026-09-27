"use server";

import { redirect } from "next/navigation";
import {
  cancelRecurrenceRule,
  createRecurrenceRule,
  generateDueOccurrences,
  pauseRecurrenceRule,
  resumeRecurrenceRule,
} from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { parseAmountToCents } from "@/lib/currency";

export async function createEntradaRecurrenceAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const company = await requirePrimaryCompany(user.id);

  const description = String(formData.get("description") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "");
  const partyId = String(formData.get("partyId") ?? "") || undefined;
  const costCenterId = String(formData.get("costCenterId") ?? "") || undefined;
  const amount = String(formData.get("amount") ?? "0");
  const dayOfMonth = Number(formData.get("dayOfMonth") ?? "0");
  const startDate = String(formData.get("startDate") ?? "");
  const endDate = String(formData.get("endDate") ?? "") || undefined;
  const notes = String(formData.get("notes") ?? "");

  let rule: Awaited<ReturnType<typeof createRecurrenceRule>>;
  try {
    rule = await createRecurrenceRule(user.id, company.id, {
      type: "RECEIVABLE",
      description,
      categoryId,
      partyId,
      costCenterId,
      amountCents: parseAmountToCents(amount),
      dayOfMonth,
      startDate,
      endDate,
      notes: notes || undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível criar a recorrência.";
    redirect(`/entradas/recorrencias?erro=${encodeURIComponent(message)}`);
  }

  redirect(`/entradas/recorrencias?criado=${rule.id}`);
}

export async function pauseEntradaRecurrenceAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const company = await requirePrimaryCompany(user.id);
  const ruleId = String(formData.get("ruleId") ?? "");

  await pauseRecurrenceRule(user.id, company.id, ruleId);

  redirect("/entradas/recorrencias");
}

export async function resumeEntradaRecurrenceAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const company = await requirePrimaryCompany(user.id);
  const ruleId = String(formData.get("ruleId") ?? "");

  await resumeRecurrenceRule(user.id, company.id, ruleId);

  redirect("/entradas/recorrencias");
}

export async function cancelEntradaRecurrenceAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const company = await requirePrimaryCompany(user.id);
  const ruleId = String(formData.get("ruleId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim() || "Cancelado pelo usuário";
  const alsoCancelOpenTitles = formData.get("alsoCancelOpenTitles") === "true";

  await cancelRecurrenceRule(user.id, company.id, ruleId, { reason, alsoCancelOpenTitles });

  redirect(`/entradas/recorrencias/${ruleId}`);
}

export async function generateEntradaOccurrencesAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const company = await requirePrimaryCompany(user.id);
  const returnTo = String(formData.get("returnTo") ?? "") || "/entradas/recorrencias";

  const result = await generateDueOccurrences(user.id, company.id);

  const separator = returnTo.includes("?") ? "&" : "?";
  redirect(`${returnTo}${separator}gerados=${result.createdCount}`);
}
