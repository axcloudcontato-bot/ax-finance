"use server";

import { redirect } from "next/navigation";
import { applyTitleBatch, previewTitleBatch } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";

export async function executeTitleBatchAction(basePath: "entradas" | "saidas", formData: FormData) {
  const user = await getCurrentUser(); if (!user) redirect("/login");
  const company = await requirePrimaryCompany(user.id);
  const titleIds = formData.getAll("titleId").map(String);
  const operation = String(formData.get("operation") ?? "");
  const input = operation === "SETTLE_FULL" ? { operation, titleIds, financialAccountId: String(formData.get("financialAccountId") ?? ""), effectiveDate: String(formData.get("effectiveDate") ?? "") }
    : operation === "CANCEL" ? { operation, titleIds, reason: String(formData.get("reason") ?? "") }
    : { operation: "CLASSIFY", titleIds, categoryId: String(formData.get("categoryId") ?? ""), costCenterId: String(formData.get("costCenterId") ?? "") || undefined };
  try {
    const preview = await previewTitleBatch(user.id, company.id, input);
    if (preview.problems.length) throw new Error(preview.problems.join("; "));
    await applyTitleBatch(user.id, company.id, input);
  } catch (error) {
    const params = new URLSearchParams(); titleIds.forEach((id) => params.append("ids", id)); params.set("erro", error instanceof Error ? error.message : "Não foi possível concluir a operação em lote.");
    redirect(`/${basePath}/lote?${params.toString()}`);
  }
  redirect(`/${basePath}?loteConcluido=${titleIds.length}`);
}
