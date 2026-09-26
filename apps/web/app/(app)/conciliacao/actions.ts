"use server";

import { redirect } from "next/navigation";
import {
  ignoreBankStatementLine,
  importBankStatement,
  reconcileBankStatementLine,
  undoReconciliation,
} from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";

export async function importBankStatementAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const company = await requirePrimaryCompany(user.id);

  const financialAccountId = String(formData.get("financialAccountId") ?? "");
  const file = formData.get("file") as File | null;

  if (!file || file.size === 0) {
    redirect(`/conciliacao?conta=${financialAccountId}&erro=${encodeURIComponent("Selecione um arquivo CSV.")}`);
  }

  let result: Awaited<ReturnType<typeof importBankStatement>>;
  try {
    const csvContent = await file.text();
    result = await importBankStatement(user.id, company.id, {
      financialAccountId,
      fileName: file.name,
      csvContent,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível importar o arquivo.";
    redirect(`/conciliacao?conta=${financialAccountId}&erro=${encodeURIComponent(message)}`);
  }

  redirect(
    `/conciliacao?conta=${financialAccountId}&importado=${result.batch.importedCount}&duplicado=${result.batch.duplicateCount}&invalido=${result.batch.invalidCount}`
  );
}

export async function reconcileLineAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const company = await requirePrimaryCompany(user.id);

  const lineId = String(formData.get("lineId") ?? "");
  const settlementId = String(formData.get("settlementId") ?? "");
  const financialAccountId = String(formData.get("financialAccountId") ?? "");

  try {
    await reconcileBankStatementLine(user.id, company.id, lineId, { settlementId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível conciliar.";
    redirect(`/conciliacao?conta=${financialAccountId}&erro=${encodeURIComponent(message)}`);
  }

  redirect(`/conciliacao?conta=${financialAccountId}`);
}

export async function ignoreLineAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const company = await requirePrimaryCompany(user.id);

  const lineId = String(formData.get("lineId") ?? "");
  const financialAccountId = String(formData.get("financialAccountId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim() || "Ignorado pelo usuário";

  try {
    await ignoreBankStatementLine(user.id, company.id, lineId, { reason });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível ignorar.";
    redirect(`/conciliacao?conta=${financialAccountId}&erro=${encodeURIComponent(message)}`);
  }

  redirect(`/conciliacao?conta=${financialAccountId}`);
}

export async function undoReconciliationAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const company = await requirePrimaryCompany(user.id);

  const lineId = String(formData.get("lineId") ?? "");
  const financialAccountId = String(formData.get("financialAccountId") ?? "");

  await undoReconciliation(user.id, company.id, lineId);

  redirect(`/conciliacao?conta=${financialAccountId}`);
}
