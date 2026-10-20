import { NextResponse } from "next/server";
import { buildCompanyFinalExport } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { todayDateOnlyString } from "@/lib/dates";
import { actionErrorMessage } from "@/lib/action-errors";
import { companyExportZip, exportJson, publicCompanyExport } from "@/lib/company-export-package";
import { readAttachmentObject } from "@/lib/attachment-storage";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  try {
    const company = await requirePrimaryCompany(user.id);
    const archive = await buildCompanyFinalExport(user.id, company.id);
    const date = todayDateOnlyString();
    if (new URL(request.url).searchParams.get("format") === "zip") {
      const iterator = companyExportZip(archive, (attachment) => readAttachmentObject(attachment.storageKey, attachment.storageBackend === "S3" ? "S3" : "LOCAL"), process.env.ATTACHMENT_SCAN_REQUIRED === "true");
      const stream = new ReadableStream<Uint8Array>({
        async pull(controller) {
          try {
            const next = await iterator.next();
            if (next.done) controller.close(); else controller.enqueue(next.value);
          } catch (error) { controller.error(error); await iterator.return(undefined); }
        },
        async cancel() { await iterator.return(undefined); },
      });
      return new Response(stream, { headers: { "content-type": "application/zip", "content-disposition": `attachment; filename="ax-finance-export-${date}.zip"`, "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
    }
    const body = exportJson(publicCompanyExport(archive));
    return new NextResponse(body, { status: 200, headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="ax-finance-export-${date}.json"`, "cache-control": "no-store", "x-content-type-options": "nosniff" } });
  } catch (error) {
    return NextResponse.json({ error: actionErrorMessage(error, "Não foi possível gerar a exportação.") }, { status: 403 });
  }
}
