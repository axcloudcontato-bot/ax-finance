import { access, mkdir } from "node:fs/promises";
import { constants } from "node:fs";
import { prisma } from "@ax-finance/db";
import { logOperationalError } from "@ax-finance/domain";
import { attachmentsRoot } from "@/lib/attachment-storage";
import { json } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks = { database: false, attachments: false };
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = true;
    const root = attachmentsRoot();
    await mkdir(root, { recursive: true });
    await access(root, constants.R_OK | constants.W_OK);
    checks.attachments = true;
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
