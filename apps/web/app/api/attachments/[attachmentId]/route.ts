import { AttachmentNotFoundError, getTitleAttachment } from "@ax-finance/domain";
import { requirePrimaryCompany } from "@/lib/company";
import { errorResponse, json } from "@/lib/api";
import { readAttachmentObject, safeOriginalFileName } from "@/lib/attachment-storage";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { attachmentId: string } }) {
  try {
    const user = await requireUser();
    const company = await requirePrimaryCompany(user.id);
    const attachment = await getTitleAttachment(user.id, company.id, params.attachmentId);
    const bytes = await readAttachmentObject(attachment.storageKey);
    const safeName = safeOriginalFileName(attachment.originalName);
    const asciiName = safeName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
    return new Response(bytes, {
      headers: {
        "Content-Type": attachment.mimeType,
        "Content-Length": String(bytes.length),
        "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(safeName)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof AttachmentNotFoundError) return json({ error: error.code, message: error.message }, 404);
    return errorResponse(error);
  }
}
