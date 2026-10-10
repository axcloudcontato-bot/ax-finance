import type { NextRequest } from "next/server";
import { getMonthlyReportData, renderMonthlyReportPdf } from "@ax-finance/domain";
import { requireUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { errorResponse } from "@/lib/api";
import { currentYearMonth, isYearMonth } from "@/lib/month";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** PDF do relatório mensal (o mesmo que vai por e-mail no início do mês). */
export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const company = await requirePrimaryCompany(user.id);
    const requested = new URL(request.url).searchParams.get("mes");
    const month = isYearMonth(requested) ? requested : currentYearMonth();
    const data = await getMonthlyReportData(user.id, company.id, month);
    const pdf = await renderMonthlyReportPdf(data);
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="relatorio-${month}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
