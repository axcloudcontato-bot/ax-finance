import type { NextRequest } from "next/server";
import { AGING_BUCKETS, type AgingBucket, assertCompanyPermission, getOpenTitlesAgingReport } from "@ax-finance/domain";
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
    const bucketParam = searchParams.get("faixa") as AgingBucket;
    const bucket = AGING_BUCKETS.includes(bucketParam) ? bucketParam : undefined;

    const report = await getOpenTitlesAgingReport(user.id, company.id, { type, asOfDate, bucket });

    const csv = toCsv(
      ["Saldos atuais em", "Referência dos atrasos", "Vencimento", "Tipo", "Descrição", "Categoria", "Cliente/fornecedor", "Centro de custo", "Saldo aberto (centavos)", "Faixa", "Dias de atraso"],
      report.entries.map((entry) => [
        formatDateOnly(report.balanceAsOfDate), formatDateOnly(report.asOfDate),
        formatDateOnly(entry.dueDate),
        entry.type === "RECEIVABLE" ? "A receber" : "A pagar",
        entry.description,
        entry.categoryName,
        entry.partyName ?? "Não informado", entry.costCenterName ?? "Não informado",
        entry.remainingCents.toString(),
        BUCKET_LABEL[entry.bucket] ?? entry.bucket,
        entry.daysLate,
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
