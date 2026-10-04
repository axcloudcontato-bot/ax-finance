import Link from "next/link";
import { formatCents } from "@/lib/currency";
import { formatDateOnly } from "@/lib/dates";

interface TitleDetailRow {
  id: string;
  type: string;
  description: string;
  dueDate: Date | string;
  remainingCents: bigint;
}

export function TitleDetailList({ titles }: { titles: TitleDetailRow[] }) {
  if (titles.length === 0) {
    return <p className="muted">Nenhuma movimentação neste grupo.</p>;
  }

  return (
    <table className="dashboard-detail-table">
      <thead>
        <tr>
          <th>Descrição</th>
          <th>Tipo</th>
          <th>Vencimento</th>
          <th>Saldo aberto</th>
        </tr>
      </thead>
      <tbody>
        {titles.map((title) => (
          <tr key={title.id}>
            <td data-label="Descrição">
              <Link href={title.type === "RECEIVABLE" ? `/entradas/${title.id}` : `/saidas/${title.id}`}>
                {title.description}
              </Link>
            </td>
            <td data-label="Tipo">{title.type === "RECEIVABLE" ? "A receber" : "A pagar"}</td>
            <td data-label="Vencimento">{formatDateOnly(title.dueDate)}</td>
            <td data-label="Saldo aberto">{formatCents(title.remainingCents)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
