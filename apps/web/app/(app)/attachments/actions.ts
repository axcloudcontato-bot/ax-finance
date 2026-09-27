"use server";

import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  ATTACHMENT_MAX_BYTES,
  createTitleAttachment,
  deleteTitleAttachment,
} from "@ax-finance/domain";
import { requirePrimaryCompany } from "@/lib/company";
import { getCurrentUser } from "@/lib/session";
import {
  deleteAttachmentObject,
  attachmentStorageBackend,
  detectAttachmentMime,
  safeOriginalFileName,
  writeAttachmentObject,
} from "@/lib/attachment-storage";
import { scanAttachment } from "@/lib/attachment-antivirus";

type TitleBasePath = "entradas" | "saidas";

function detailPath(basePath: TitleBasePath, titleId: string) {
  return `/${basePath}/${titleId}`;
}

export async function uploadTitleAttachmentAction(
  basePath: TitleBasePath,
  titleId: string,
  formData: FormData
) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await requirePrimaryCompany(user.id);
  const returnPath = detailPath(basePath, titleId);
  const file = formData.get("file");
  let storageKey: string | undefined;

  try {
    if (!(file instanceof File) || file.size === 0) throw new Error("Selecione um arquivo.");
    if (file.size > ATTACHMENT_MAX_BYTES) throw new Error("O arquivo deve ter no máximo 10 MB.");
    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = detectAttachmentMime(buffer);
    if (!mimeType) throw new Error("Formato não permitido. Envie PDF, JPG, PNG ou WebP.");
    const scan = await scanAttachment(buffer);

    const attachmentId = randomUUID();
    storageKey = `${company.id}/${titleId}/${attachmentId}`;
    await writeAttachmentObject(storageKey, buffer);
    await createTitleAttachment(user.id, company.id, titleId, {
      id: attachmentId,
      originalName: safeOriginalFileName(file.name),
      mimeType,
      sizeBytes: buffer.length,
      sha256: createHash("sha256").update(buffer).digest("hex"),
      storageKey,
      storageBackend: attachmentStorageBackend(),
      scanStatus: scan.status,
      scannedAt: scan.scannedAt,
    });
  } catch (error) {
    if (storageKey) await deleteAttachmentObject(storageKey).catch(() => undefined);
    const message = error instanceof Error ? error.message : "Não foi possível enviar o anexo.";
    redirect(`${returnPath}?erroAnexo=${encodeURIComponent(message)}`);
  }

  revalidatePath(returnPath);
  redirect(`${returnPath}?anexoAdicionado=1`);
}

export async function deleteTitleAttachmentAction(
  basePath: TitleBasePath,
  titleId: string,
  attachmentId: string
) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await requirePrimaryCompany(user.id);
  const returnPath = detailPath(basePath, titleId);

  try {
    const attachment = await deleteTitleAttachment(user.id, company.id, attachmentId);
    await deleteAttachmentObject(attachment.storageKey, attachment.storageBackend === "S3" ? "S3" : "LOCAL");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível remover o anexo.";
    redirect(`${returnPath}?erroAnexo=${encodeURIComponent(message)}`);
  }

  revalidatePath(returnPath);
  redirect(`${returnPath}?anexoRemovido=1`);
}
