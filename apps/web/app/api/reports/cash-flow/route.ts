import type { NextRequest } from "next/server";
import { getCashFlowReport } from "@ax-finance/domain";
import { requireUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { errorResponse } from "@/lib/api";
import { formatDateOnly, todayDateOnlyString } from "@/lib/dates";
import { toCsv } from "@/lib/csv";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const company = await requirePrimaryCompany(user.id);

    const { searchParams } = new URL(request.url);
    const from = searchParams.get("de") || `${todayDateOnlyString().slice(0, 8)}01`;
    const to = searchParams.get("ate") || todayDateOnlyString();

    const report = await getCashFlowReport(user.id, company.id, { from, to });

    const csv = toCsv(
      ["Data", "Tipo", "Descrição", "Categoria", "Valor (centavos)"],
      report.entries.map((entry) => [
        formatDateOnly(entry.effectiveDate),
        entry.titleType === "RECEIVABLE" ? "Entrada" : "Saída",
        entry.titleDescription,
        entry.categoryName,
        entry.cashDeltaCents.toString(),
      ])
    );

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="fluxo-de-caixa-${from}-a-${to}.csv"`,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
