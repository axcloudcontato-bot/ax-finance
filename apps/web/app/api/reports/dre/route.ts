import type { NextRequest } from "next/server";
import { assertCompanyPermission, getManagerialIncomeStatement } from "@ax-finance/domain";
import { requireUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { errorResponse } from "@/lib/api";
import { todayDateOnlyString } from "@/lib/dates";
import { toCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const company = await requirePrimaryCompany(user.id);
    await assertCompanyPermission(user.id, company.id, "EXPORT");

    const { searchParams } = new URL(request.url);
    const from = searchParams.get("de") || `${todayDateOnlyString().slice(0, 8)}01`;
    const to = searchParams.get("ate") || todayDateOnlyString();

    const report = await getManagerialIncomeStatement(user.id, company.id, { from, to });

    const csv = toCsv(
      ["Seção", "Grupo gerencial", "Valor (centavos)"],
      [
        ...report.groups.map((group) => ["Resultado operacional", group.label, group.cents.toString()]),
        ["Resultado operacional", "Total", report.operatingResultCents.toString()],
        ...report.financialLines.map((line) => ["Resultado financeiro", line.label, line.cents.toString()]),
        ["Resultado financeiro", "Total", report.financialResultCents.toString()],
        ["Resultado do período", "Total", report.totalCents.toString()],
        ...report.outsideResult.map((line) => ["Fora do resultado (informativo)", line.label, line.cents.toString()]),
      ]
    );

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="dre-gerencial-${from}-a-${to}.csv"`,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
