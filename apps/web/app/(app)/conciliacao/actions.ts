"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import {
  BACKGROUND_IMPORT_BYTES,
  BACKGROUND_IMPORT_ROWS,
  clearBankImportStorageKey,
  confirmBankImport,
  createBankImportPreview,
  decodeImportSource,
  deleteImportSource,
  getBankImportBatch,
  ignoreBankStatementLine,
  importStorageKey,
  markBankImportFailed,
  MAX_IMPORT_FILE_BYTES,
  previewBankStatement,
  processBankImportBatch,
  readImportSource,
  reconcileBankStatementLine,
  safeImportFileName,
  undoReconciliation,
  writeImportSource,
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
    redirect(`/conciliacao?conta=${financialAccountId}&erro=${encodeURIComponent("Selecione um arquivo CSV ou OFX.")}`);
  }
  if (file.size > MAX_IMPORT_FILE_BYTES) {
    redirect(`/conciliacao?conta=${financialAccountId}&erro=${encodeURIComponent("O arquivo deve ter no máximo 20 MB.")}`);
  }

  const batchId = randomUUID();
  let storageKey: string | undefined;
  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const content = decodeImportSource(bytes);
    const fileName = safeImportFileName(file.name);
    const preview = previewBankStatement(fileName, content);
    storageKey = importStorageKey(company.id, batchId, preview.format);
    await writeImportSource(storageKey, bytes);
    await createBankImportPreview(user.id, company.id, {
      id: batchId,
      financialAccountId,
      fileName,
      fileFormat: preview.format,
      fileSizeBytes: bytes.length,
      storageKey,
      detectedRowCount: preview.totalRows,
    });
  } catch (error) {
    if (storageKey) await deleteImportSource(storageKey).catch(() => undefined);
    const message = error instanceof Error ? error.message : "Não foi possível importar o arquivo.";
    redirect(`/conciliacao?conta=${financialAccountId}&erro=${encodeURIComponent(message)}`);
  }
  redirect(`/conciliacao/importacoes/${batchId}`);
}

export async function confirmBankImportAction(batchId: string, formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await requirePrimaryCompany(user.id);
  let batch: Awaited<ReturnType<typeof getBankImportBatch>> | null = null;
  let confirmed = false;
  try {
    batch = await getBankImportBatch(user.id, company.id, batchId);
    const mapping = batch.fileFormat === "CSV" ? {
      dateColumn: String(formData.get("dateColumn") ?? ""),
      descriptionColumn: String(formData.get("descriptionColumn") ?? ""),
      amountColumn: String(formData.get("amountColumn") ?? "") || undefined,
      debitColumn: String(formData.get("debitColumn") ?? "") || undefined,
      creditColumn: String(formData.get("creditColumn") ?? "") || undefined,
    } : undefined;
    const processInBackground = batch.fileSizeBytes >= BACKGROUND_IMPORT_BYTES
      || batch.rowCount >= BACKGROUND_IMPORT_ROWS;
    await confirmBankImport(user.id, company.id, batch.id, { mapping, processInBackground });
    confirmed = true;
    if (processInBackground) {
      redirect(`/conciliacao?conta=${batch.financialAccountId}&enfileirado=1`);
    }
    if (!batch.storageKey) throw new Error("Arquivo temporário não encontrado.");
    const bytes = await readImportSource(batch.storageKey);
    const result = await processBankImportBatch(user.id, company.id, batch.id, decodeImportSource(bytes));
    await deleteImportSource(batch.storageKey);
    await clearBankImportStorageKey(user.id, company.id, batch.id);
    redirect(
      `/conciliacao?conta=${batch.financialAccountId}&importado=${result.importedCount}&duplicado=${result.duplicateCount}&invalido=${result.invalidCount}`
    );
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    const message = error instanceof Error ? error.message : "Não foi possível confirmar a importação.";
    if (confirmed && batch) {
      await markBankImportFailed(user.id, company.id, batch.id, error).catch(() => undefined);
      if (batch.storageKey) await deleteImportSource(batch.storageKey).catch(() => undefined);
      await clearBankImportStorageKey(user.id, company.id, batch.id).catch(() => undefined);
      redirect(`/conciliacao?conta=${batch.financialAccountId}&erro=${encodeURIComponent(message)}`);
    }
    redirect(`/conciliacao/importacoes/${batchId}?erro=${encodeURIComponent(message)}`);
  }
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
