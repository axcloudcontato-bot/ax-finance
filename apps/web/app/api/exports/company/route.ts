import { NextResponse } from "next/server";
import { buildCompanyFinalExport } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  try {
    const company = await requirePrimaryCompany(user.id);
    const archive = await buildCompanyFinalExport(user.id, company.id);
    const body = JSON.stringify(archive, (_key, value) => typeof value === "bigint" ? value.toString() : value, 2);
    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(body, { status: 200, headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="ax-finance-export-${date}.json"`, "cache-control": "no-store", "x-content-type-options": "nosniff" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível gerar a exportação." }, { status: 403 });
  }
}
