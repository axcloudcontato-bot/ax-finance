import type { NextRequest } from "next/server";
import { assertCompanyPermission, getCashFlowReport } from "@ax-finance/domain";
import { requireUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { errorResponse } from "@/lib/api";
import { formatDateOnly, todayDateOnlyString } from "@/lib/dates";
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

    const report = await getCashFlowReport(user.id, company.id, { from, to });

    const csv = toCsv(
      ["Registro", "Data", "Direção de caixa", "Descrição", "Categoria", "Conta", "Valor (centavos)"],
      [...report.entries.map((entry) => [
        entry.kind === "REFUND" ? "Devolução/reembolso" : "Baixa",
        formatDateOnly(entry.effectiveDate),
        entry.cashDeltaCents >= BigInt(0) ? "Entrada" : "Saída",
        entry.titleDescription,
        entry.categoryName,
        entry.accountName,
        entry.cashDeltaCents.toString(),
      ]),
      ["Conferência", formatDateOnly(report.openingBalanceDate), "", "Saldo inicial", "", "Todas as contas", report.openingBalanceCents.toString()],
      ["Conferência", "", "", "Baixas e devoluções", "", "", report.totalCents.toString()],
      ["Conferência", "", "", "Outras alterações de saldo", "", "", report.otherBalanceChangesCents.toString()],
      ["Conferência", formatDateOnly(report.closingBalanceDate), "", "Saldo final", "", "Todas as contas", report.closingBalanceCents.toString()],
      ["Conferência", "", "", "Diferença a conferir (esperado zero)", "", "", report.balanceDifferenceCents.toString()],
      ]
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
