import type { NextRequest } from "next/server";
import { assertCompanyPermission, getOpenTitlesAgingReport } from "@ax-finance/domain";
import { requireUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { errorResponse } from "@/lib/api";
import { formatDateOnly, todayDateOnlyString } from "@/lib/dates";
import { toCsv } from "@/lib/csv";
import { BUCKET_LABEL } from "@/lib/aging-labels";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const company = await requirePrimaryCompany(user.id);
    await assertCompanyPermission(user.id, company.id, "EXPORT");

    const { searchParams } = new URL(request.url);
    const typeParam = searchParams.get("tipo");
    const type = typeParam === "RECEIVABLE" || typeParam === "PAYABLE" ? typeParam : undefined;
    const asOfDate = searchParams.get("data") || todayDateOnlyString();

    const report = await getOpenTitlesAgingReport(user.id, company.id, { type, asOfDate });

    const csv = toCsv(
      ["Vencimento", "Tipo", "Descrição", "Categoria", "Saldo aberto (centavos)", "Faixa"],
      report.entries.map((entry) => [
        formatDateOnly(entry.dueDate),
        entry.type === "RECEIVABLE" ? "Entrada" : "Saída",
        entry.description,
        entry.categoryName,
        entry.remainingCents.toString(),
        BUCKET_LABEL[entry.bucket] ?? entry.bucket,
      ])
    );

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="contas-em-aberto-${asOfDate}.csv"`,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
