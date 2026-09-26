import { redirect } from "next/navigation";
import { getCashFlowReport } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { formatCents } from "@/lib/currency";
import { formatDateOnly } from "@/lib/dates";
import { NATURE_LABEL } from "@/lib/category-labels";
import { currentYearMonth, monthRange } from "@/lib/month";

export default async function FluxoDeCaixaPage({
  searchParams,
}: {
  searchParams: { de?: string; ate?: string; mes?: string };
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const company = await requirePrimaryCompany(user.id);

  const month = searchParams.mes ?? currentYearMonth();
  const defaultRange = monthRange(month);
  const from = searchParams.de || defaultRange.from;
  const to = searchParams.ate || defaultRange.to;

  const report = await getCashFlowReport(user.id, company.id, { from, to });
  const exportHref = `/api/reports/cash-flow?de=${from}&ate=${to}`;

  return (
    <main className="wide">
      <h1 style={{ marginBottom: "0.25rem" }}>Fluxo de caixa realizado</h1>
      <p className="muted" style={{ marginBottom: "1rem" }}>
        {company.name} · {formatDateOnly(from)} a {formatDateOnly(to)} · gerado em{" "}
        {new Date().toLocaleString("pt-BR")}
      </p>

      <div className="card">
        <form method="get" style={{ display: "flex", gap: "1rem", alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <label htmlFor="de">De</label>
            <input id="de" name="de" type="date" defaultValue={from} />
          </div>
          <div>
            <label htmlFor="ate">Até</label>
            <input id="ate" name="ate" type="date" defaultValue={to} />
          </div>
          <button type="submit" style={{ marginTop: 0 }}>
            Filtrar intervalo customizado
          </button>
          <a href={exportHref} className="button-link">
            Exportar CSV
          </a>
        </form>
      </div>

      <div className="card">
        <h1>Por natureza</h1>
        {report.subtotalsByNature.length === 0 ? (
          <p className="muted">Nenhuma baixa no período.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Natureza</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              {report.subtotalsByNature.map((row) => (
                <tr key={row.nature}>
                  <td>{NATURE_LABEL[row.nature] ?? row.nature}</td>
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
        )}
      </div>

      <div className="card">
        <h1>Baixas do período</h1>
        {report.entries.length === 0 ? (
          <p className="muted">Nenhuma baixa no período.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Tipo</th>
                <th>Descrição</th>
                <th>Categoria</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              {report.entries.map((entry) => (
                <tr key={entry.settlementId}>
                  <td>{formatDateOnly(entry.effectiveDate)}</td>
                  <td>{entry.titleType === "RECEIVABLE" ? "Entrada" : "Saída"}</td>
                  <td>{entry.titleDescription}</td>
                  <td>{entry.categoryName}</td>
                  <td>{formatCents(entry.cashDeltaCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
