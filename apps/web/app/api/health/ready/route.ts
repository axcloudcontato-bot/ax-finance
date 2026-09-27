import { prisma } from "@ax-finance/db";
import { logOperationalError } from "@ax-finance/domain";
import { checkAttachmentStorageReady } from "@/lib/attachment-storage";
import { checkAttachmentScannerReady } from "@/lib/attachment-antivirus";
import { json } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks = { database: false, attachments: false, antivirus: false };
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = true;
    await checkAttachmentStorageReady();
    checks.attachments = true;
    await checkAttachmentScannerReady();
    checks.antivirus = true;
    return json({ status: "ready", checks }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    logOperationalError("web.readiness_failed", error, checks);
    return json({ status: "not_ready", checks }, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
