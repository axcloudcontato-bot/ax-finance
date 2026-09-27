import { z } from "zod";
import { withCompanyContext } from "@ax-finance/db";
import { recordAuditEvent } from "../audit/record-audit-event";
import { assertCompanyPermission } from "../companies/permissions";
import { AttachmentNotFoundError, TitleNotFoundError } from "../errors";

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const attachmentMetadataInput = z.object({
  id: z.string().uuid(),
  originalName: z.string().trim().min(1).max(255).refine((value) => !/[\u0000-\u001f\u007f]/.test(value)),
  mimeType: z.enum(ALLOWED_MIME_TYPES),
  sizeBytes: z.number().int().positive().max(10 * 1024 * 1024),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  storageKey: z.string().regex(/^[a-f0-9-]{36}\/[a-f0-9-]{36}\/[a-f0-9-]{36}$/),
  storageBackend: z.enum(["LOCAL", "S3"]).default("LOCAL"),
  scanStatus: z.enum(["NOT_SCANNED", "CLEAN"]).default("NOT_SCANNED"),
  scannedAt: z.coerce.date().optional(),
});

export const ATTACHMENT_ALLOWED_MIME_TYPES = [...ALLOWED_MIME_TYPES];
export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

export async function createTitleAttachment(
  userId: string,
  companyId: string,
  titleId: string,
  input: unknown
) {
  await assertCompanyPermission(userId, companyId, "FINANCE_WRITE");
  const data = attachmentMetadataInput.parse(input);
  if (data.storageKey !== `${companyId}/${titleId}/${data.id}`) {
    throw new Error("Chave de armazenamento incompatível com o título.");
  }
  return withCompanyContext(userId, companyId, async (tx) => {
    const title = await tx.title.findFirst({ where: { id: titleId, companyId, deletedAt: null } });
    if (!title) throw new TitleNotFoundError();
    const attachment = await tx.attachment.create({
      data: { ...data, companyId, titleId, uploadedByUserId: userId },
    });
    await recordAuditEvent(tx, {
      companyId,
      actorUserId: userId,
      eventType: "ATTACHMENT_ADDED",
      resourceType: "Title",
      resourceId: titleId,
      summary: data.originalName,
      metadata: { attachmentId: attachment.id, mimeType: data.mimeType, sizeBytes: data.sizeBytes },
    });
    return attachment;
  });
}

export async function listTitleAttachments(userId: string, companyId: string, titleId: string) {
  await assertCompanyPermission(userId, companyId, "FINANCE_READ");
  return withCompanyContext(userId, companyId, async (tx) => {
    const title = await tx.title.findFirst({ where: { id: titleId, companyId, deletedAt: null }, select: { id: true } });
    if (!title) throw new TitleNotFoundError();
    return tx.attachment.findMany({
      where: { companyId, titleId },
      include: { uploadedBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });
  });
}

export async function getTitleAttachment(userId: string, companyId: string, attachmentId: string) {
  await assertCompanyPermission(userId, companyId, "FINANCE_READ");
  const attachment = await withCompanyContext(userId, companyId, (tx) => tx.attachment.findFirst({
    where: { id: attachmentId, companyId, title: { deletedAt: null } },
  }));
  if (!attachment) throw new AttachmentNotFoundError();
  return attachment;
}

export async function deleteTitleAttachment(userId: string, companyId: string, attachmentId: string) {
  await assertCompanyPermission(userId, companyId, "FINANCE_WRITE");
  return withCompanyContext(userId, companyId, async (tx) => {
    const attachment = await tx.attachment.findFirst({ where: { id: attachmentId, companyId } });
    if (!attachment) throw new AttachmentNotFoundError();
    await tx.attachment.delete({ where: { id: attachment.id } });
    await recordAuditEvent(tx, {
      companyId,
      actorUserId: userId,
      eventType: "ATTACHMENT_DELETED",
      resourceType: "Title",
      resourceId: attachment.titleId,
      summary: attachment.originalName,
      metadata: { attachmentId: attachment.id },
    });
    return attachment;
  });
}
