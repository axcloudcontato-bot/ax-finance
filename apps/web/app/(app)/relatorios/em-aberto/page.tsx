import { redirect } from "next/navigation";
import { getOpenTitlesAgingReport } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { formatCents } from "@/lib/currency";
import { formatDateOnly, todayDateOnlyString } from "@/lib/dates";
import { BUCKET_LABEL } from "@/lib/aging-labels";

export default async function EmAbertoPage(
  props: {
    searchParams: Promise<{ tipo?: string; data?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const company = await requirePrimaryCompany(user.id);

  const type = searchParams.tipo === "RECEIVABLE" || searchParams.tipo === "PAYABLE" ? searchParams.tipo : undefined;
  const asOfDate = searchParams.data || todayDateOnlyString();

  const report = await getOpenTitlesAgingReport(user.id, company.id, { type, asOfDate });
  const exportHref = `/api/reports/aging?data=${asOfDate}${type ? `&tipo=${type}` : ""}`;

  return (
    <main className="wide">
      <h1 style={{ marginBottom: "0.25rem" }}>Contas em aberto</h1>
      <p className="muted" style={{ marginBottom: "1rem" }}>
        {company.name} · posição em {formatDateOnly(asOfDate)} · gerado em{" "}
        {new Date().toLocaleString("pt-BR")}
      </p>

      <div className="card">
        <form method="get" style={{ display: "flex", gap: "1rem", alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <label htmlFor="tipo">Tipo</label>
            <select id="tipo" name="tipo" defaultValue={type ?? ""}>
              <option value="">Entradas e saídas</option>
              <option value="RECEIVABLE">Só entradas</option>
              <option value="PAYABLE">Só saídas</option>
            </select>
          </div>
          <div>
            <label htmlFor="data">Data de referência</label>
            <input id="data" name="data" type="date" defaultValue={asOfDate} />
          </div>
          <button type="submit" style={{ marginTop: 0 }}>
            Filtrar
          </button>
          <a href={exportHref} className="button-link">
            Exportar CSV
          </a>
        </form>
      </div>

      <div className="card">
        <h1>Por faixa de atraso</h1>
        <table>
          <thead>
            <tr>
              <th>Faixa</th>
              <th>Saldo aberto</th>
            </tr>
          </thead>
          <tbody>
            {report.totalsByBucket.map((row) => (
              <tr key={row.bucket}>
                <td>{BUCKET_LABEL[row.bucket] ?? row.bucket}</td>
                <td>{formatCents(row.cents)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td style={{ fontWeight: 700 }}>Total</td>
              <td style={{ fontWeight: 700 }}>{formatCents(report.totalCents)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="card">
        <h1>Títulos em aberto</h1>
        {report.entries.length === 0 ? (
          <p className="muted">Nada em aberto.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Vencimento</th>
                <th>Tipo</th>
                <th>Descrição</th>
                <th>Categoria</th>
                <th>Saldo aberto</th>
                <th>Faixa</th>
              </tr>
            </thead>
            <tbody>
              {report.entries.map((entry) => (
                <tr key={entry.titleId}>
                  <td>{formatDateOnly(entry.dueDate)}</td>
                  <td>{entry.type === "RECEIVABLE" ? "Entrada" : "Saída"}</td>
                  <td>{entry.description}</td>
                  <td>{entry.categoryName}</td>
                  <td>{formatCents(entry.remainingCents)}</td>
                  <td>{BUCKET_LABEL[entry.bucket] ?? entry.bucket}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
