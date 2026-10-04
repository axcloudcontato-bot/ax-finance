import Link from "next/link";
import type { listTitles } from "@ax-finance/domain";
import { formatCents } from "@/lib/currency";
import { formatDateOnly } from "@/lib/dates";
import { TitleStatusBadge } from "./title-status-badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { TitleColumnPreferences } from "./title-column-preferences";

type TitleRow = Awaited<ReturnType<typeof listTitles>>[number];

export function TitleListTable({ titles, basePath, userId, companyId }: { titles: TitleRow[]; basePath: "/entradas" | "/saidas"; userId: string; companyId: string }) {
  return (
    <TitleColumnPreferences scope={`${userId}:${companyId}`} pageName={basePath === "/entradas" ? "Entradas" : "Saídas"}>
      {titles.length === 0 ? <p className="muted">Nenhum lançamento ainda.</p> : (
        <form action={`${basePath}/lote`} method="get">
          <table className="title-list-table">
            <thead>
              <tr>
                <th><span className="sr-only">Selecionar</span></th>
                <th>Descrição</th>
                <th data-column="category">Categoria</th>
                <th data-column="costCenter">Centro de custo</th>
                <th data-column="dueDate">Vencimento</th>
                <th data-column="amount">Valor</th>
                <th data-column="remaining">Saldo aberto</th>
                <th data-column="status">Situação</th>
              </tr>
            </thead>
            <tbody>
              {titles.map((title) => (
                <tr key={title.id}>
                  <td><input type="checkbox" name="ids" value={title.id} aria-label={`Selecionar ${title.description}`} /></td>
                  <td><Link href={`${basePath}/${title.id}`}>{title.description}</Link></td>
                  <td data-column="category">{title.category.name}</td>
                  <td data-column="costCenter">{title.costCenter?.name ?? "—"}</td>
                  <td data-column="dueDate">{formatDateOnly(title.dueDate)}</td>
                  <td data-column="amount">{formatCents(title.originalAmountCents, title.currency)}</td>
                  <td data-column="remaining">{formatCents(title.remainingCents, title.currency)}</td>
                  <td data-column="status"><TitleStatusBadge status={title.status} dueDate={title.dueDate} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <SubmitButton className="secondary" style={{ marginTop: "1rem" }}>Operações em lote</SubmitButton>
        </form>
      )}
    </TitleColumnPreferences>
  );
}
