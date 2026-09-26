import Link from "next/link";
import type { listTitles } from "@ax-finance/domain";
import { formatCents } from "@/lib/currency";
import { formatDateOnly } from "@/lib/dates";
import { TitleStatusBadge } from "./title-status-badge";

type TitleRow = Awaited<ReturnType<typeof listTitles>>[number];

export function TitleListTable({ titles, basePath }: { titles: TitleRow[]; basePath: string }) {
  if (titles.length === 0) {
    return <p className="muted">Nenhum lançamento ainda.</p>;
  }

  return (
    <table>
      <thead>
        <tr>
          <th>Descrição</th>
          <th>Categoria</th>
          <th>Vencimento</th>
          <th>Valor</th>
          <th>Saldo aberto</th>
          <th>Situação</th>
        </tr>
      </thead>
      <tbody>
        {titles.map((title) => (
          <tr key={title.id}>
            <td>
              <Link href={`${basePath}/${title.id}`}>{title.description}</Link>
            </td>
            <td>{title.category.name}</td>
            <td>{formatDateOnly(title.dueDate)}</td>
            <td>{formatCents(title.originalAmountCents, title.currency)}</td>
            <td>{formatCents(title.remainingCents, title.currency)}</td>
            <td>
              <TitleStatusBadge status={title.status} dueDate={title.dueDate} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
