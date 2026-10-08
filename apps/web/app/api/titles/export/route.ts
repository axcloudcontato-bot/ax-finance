import type { NextRequest } from "next/server";
import { TITLE_LIST_VIEWS, assertCompanyPermission, listTitlesForExport, paymentMethodLabel, type TitleListView } from "@ax-finance/domain";
import { requireUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { errorResponse } from "@/lib/api";
import { formatDateOnly, todayDateOnlyString } from "@/lib/dates";
import { toCsv } from "@/lib/csv";
import { resolvePeriodRange } from "@/lib/month";
import { parseTitleListQuery } from "@/lib/title-list-params";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  OPEN: "Em aberto",
  PARTIALLY_SETTLED: "Parcialmente baixado",
  SETTLED: "Quitado",
  CANCELLED: "Cancelado",
};

/** 1234.5 centavos -> "12,34" (sem símbolo, para a planilha somar). */
const decimal = (cents: bigint) => (Number(cents) / 100).toFixed(2).replace(".", ",");

/**
 * Exporta a lista de entradas ou saídas com os MESMOS filtros da tela (período, visão, busca, categoria,
 * pessoa, centro de custo, faixa de valor e ordem), sem a paginação. Separador ";" e BOM para o Excel em
 * português abrir os acentos e as vírgulas direito.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const company = await requirePrimaryCompany(user.id);
    await assertCompanyPermission(user.id, company.id, "EXPORT");

    const query = Object.fromEntries(new URL(request.url).searchParams) as Record<string, string>;
    const type = query.tipo === "PAYABLE" ? "PAYABLE" : "RECEIVABLE";
    const period = resolvePeriodRange(query);
    const view: TitleListView = (TITLE_LIST_VIEWS as readonly string[]).includes(query.filtro ?? "") ? (query.filtro as TitleListView) : "todas";
    const today = todayDateOnlyString();

    const { titles, truncated } = await listTitlesForExport(user.id, company.id, {
      type,
      view,
      from: period.from,
      to: period.to,
      today,
      ...parseTitleListQuery(query),
    });

    const csv = toCsv(
      ["Vencimento", "Competência", "Descrição", type === "RECEIVABLE" ? "Cliente" : "Fornecedor", "Categoria", "Centro de custo", "Conta prevista", "Documento", "Forma de pagamento", "Valor", "Saldo aberto", "Situação", "Agendado para"],
      titles.map((title) => [
        formatDateOnly(title.dueDate),
        formatDateOnly(title.competenceDate),
        title.description,
        title.party?.name ?? "",
        title.category.name,
        title.costCenter?.name ?? "",
        title.expectedAccount?.name ?? "",
        title.documentNumber ?? "",
        paymentMethodLabel(title.expectedPaymentMethod) ?? "",
        decimal(title.originalAmountCents),
        decimal(title.status === "CANCELLED" ? BigInt(0) : title.remainingCents),
        STATUS_LABEL[title.status] ?? title.status,
        title.scheduledPaymentDate ? formatDateOnly(title.scheduledPaymentDate) : "",
      ]),
      ";",
    );

    const body = `\uFEFF${csv}${truncated ? "\r\nAviso;A exportação foi limitada às primeiras 10.000 linhas. Refine os filtros." : ""}`;
    const name = type === "RECEIVABLE" ? "entradas" : "saidas";
    return new Response(body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${name}-${today}.csv"`,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
