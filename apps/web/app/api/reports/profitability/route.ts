import type { NextRequest } from "next/server";
import { assertCompanyPermission, getProfitabilityReport } from "@ax-finance/domain";
import { requireUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { resolvePeriodRange } from "@/lib/month";
import { errorResponse } from "@/lib/api";
import { toCsv } from "@/lib/csv";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const company = await requirePrimaryCompany(user.id);
    await assertCompanyPermission(user.id, company.id, "EXPORT");
    const query = Object.fromEntries(new URL(request.url).searchParams);
    const { from, to } = resolvePeriodRange(query);
    const report = await getProfitabilityReport(user.id, company.id, { from, to, fixedAllocation: query.rateio === "REVENUE" ? "REVENUE" : "NONE", snapshotId: query.versao });
    const rows = [...report.rows, { ...report.totals, fixedCents: report.totals.fixedCents - report.allocatedFixedCents, allocatedFixedCents: report.allocatedFixedCents }];
    const csv = toCsv(["Centro", "Receita operacional registrada (centavos)", "Variáveis (centavos)", "Contribuição (centavos)", "Fixos diretos (centavos)", "Fixos rateados (centavos)", "Não classificados (centavos)", "Resultado operacional (centavos)", "Ponto de equilíbrio (centavos)", "Critério de rateio", "Posição"], rows.map((row) => [row.name, row.revenueCents.toString(), row.variableCents.toString(), row.contributionCents?.toString() ?? "Base incompleta", row.fixedCents.toString(), row.allocatedFixedCents.toString(), row.unclassifiedCents.toString(), row.resultCents.toString(), row.breakEvenCents?.toString() ?? "Sem base válida", report.fixedAllocation, report.capturedAsOf ?? "Registros vigentes"]));
    return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="rentabilidade-${from}-${to}.csv"`, "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}
