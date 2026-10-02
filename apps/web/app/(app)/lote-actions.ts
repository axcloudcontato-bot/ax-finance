"use server";

import { redirect } from "next/navigation";
import { TitleBatchInvalidError, applyTitleBatch, previewTitleBatch } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";

export async function executeTitleBatchAction(basePath: "entradas" | "saidas", formData: FormData) {
  const user = await getCurrentUser(); if (!user) redirect("/login");
  const company = await requirePrimaryCompany(user.id);
  const titleIds = formData.getAll("titleId").map(String);
  const operation = String(formData.get("operation") ?? "");
  const idempotencyKey = String(formData.get("idempotencyKey") ?? "") || undefined;
  const input = operation === "SETTLE_FULL" ? { operation, titleIds, financialAccountId: String(formData.get("financialAccountId") ?? ""), effectiveDate: String(formData.get("effectiveDate") ?? ""), idempotencyKey }
    : operation === "CANCEL" ? { operation, titleIds, reason: String(formData.get("reason") ?? ""), idempotencyKey }
    : { operation: "CLASSIFY", titleIds, categoryId: String(formData.get("categoryId") ?? ""), costCenterId: String(formData.get("costCenterId") ?? "") || undefined, idempotencyKey };
  try {
    // Aplica direto (o domínio valida tudo): se um reenvio com a mesma chave
    // passasse antes por uma pré-validação, o saldo já liquidado viraria um
    // erro "sem saldo aberto" em vez de reaproveitar o resultado.
    await applyTitleBatch(user.id, company.id, input);
  } catch (error) {
    let message = error instanceof Error ? error.message : "Não foi possível concluir a operação em lote.";
    if (error instanceof TitleBatchInvalidError) {
      const preview = await previewTitleBatch(user.id, company.id, input).catch(() => null);
      if (preview?.problems.length) message = preview.problems.join("; ");
    }
    const params = new URLSearchParams(); titleIds.forEach((id) => params.append("ids", id)); params.set("erro", message);
    redirect(`/${basePath}/lote?${params.toString()}`);
  }
  redirect(`/${basePath}?loteConcluido=${titleIds.length}`);
}
