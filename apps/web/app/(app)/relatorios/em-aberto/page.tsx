import Link from "next/link";
import { redirect } from "next/navigation";
import { getOpenTitlesAgingReport } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { formatCents } from "@/lib/currency";
import { formatDateOnly, todayDateOnlyString } from "@/lib/dates";
import { BUCKET_LABEL } from "@/lib/aging-labels";
import { SubmitButton } from "@/components/ui/submit-button";

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
  const byType = { RECEIVABLE: new Map<string, bigint>(), PAYABLE: new Map<string, bigint>() };
  for (const entry of report.entries) {
    const totals = byType[entry.type];
    totals.set(entry.bucket, (totals.get(entry.bucket) ?? BigInt(0)) + entry.remainingCents);
  }
  const receivableCents = report.entries.filter((entry) => entry.type === "RECEIVABLE")
    .reduce((sum, entry) => sum + entry.remainingCents, BigInt(0));
  const payableCents = report.totalCents - receivableCents;
  const upcomingCents = report.totalsByBucket.find((row) => row.bucket === "A_VENCER")?.cents ?? BigInt(0);
  const overdueCents = report.totalCents - upcomingCents;
  const overdueReceivableCents = receivableCents - (byType.RECEIVABLE.get("A_VENCER") ?? BigInt(0));
  const overduePayableCents = payableCents - (byType.PAYABLE.get("A_VENCER") ?? BigInt(0));
  const percentOf = (value: bigint, total: bigint) => total > BigInt(0) ? Number(value * BigInt(100) / total) : 0;

  return (
    <main className="wide">
      <div className="page-header"><h1>Contas em aberto</h1><a href={exportHref} className="button-link">Exportar CSV</a></div>
      <p className="muted" style={{ marginBottom: "1rem" }}>
        {company.name} · posição em {formatDateOnly(asOfDate)} · gerado em{" "}
        {new Date().toLocaleString("pt-BR")}
      </p>

      <div className="card">
        <form method="get" className="workspace-report-filters">
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
          <SubmitButton style={{ marginTop: 0 }}>
            Filtrar
          </SubmitButton>
        </form>
      </div>

      {type ? (
        <section className="workspace-metrics" aria-label="Resumo das contas em aberto">
          <div className="workspace-metric workspace-metric-primary"><span className="workspace-metric-label">{type === "RECEIVABLE" ? "A receber" : "A pagar"}</span><strong>{formatCents(report.totalCents)}</strong><span className="workspace-metric-detail">{report.entries.length} {report.entries.length === 1 ? "título" : "títulos"} na seleção</span></div>
          <div className="workspace-metric workspace-metric-alert"><span className="workspace-metric-label">Vencido</span><strong>{formatCents(overdueCents)}</strong><span className="workspace-metric-detail">Vencimento anterior a {formatDateOnly(asOfDate)}</span></div>
          <div className="workspace-metric"><span className="workspace-metric-label">A vencer</span><strong>{formatCents(upcomingCents)}</strong><span className="workspace-metric-detail">Vencimentos na data ou depois</span></div>
        </section>
      ) : (
        <section className="workspace-metrics" aria-label="Resumo das contas a receber e a pagar">
          <div className="workspace-metric workspace-metric-primary"><span className="workspace-metric-label">A receber</span><strong>{formatCents(receivableCents)}</strong><span className="workspace-metric-detail">Direitos ainda não recebidos</span></div>
          <div className="workspace-metric"><span className="workspace-metric-label">A pagar</span><strong>{formatCents(payableCents)}</strong><span className="workspace-metric-detail">Obrigações ainda não pagas</span></div>
          <div className="workspace-metric workspace-metric-alert"><span className="workspace-metric-label">Vencidos</span><strong>{formatCents(overdueCents)}</strong><span className="workspace-metric-detail">{formatCents(overdueReceivableCents)} a receber · {formatCents(overduePayableCents)} a pagar</span></div>
        </section>
      )}

      <div className="card">
        <h2>Por faixa de atraso</h2>
        <div className="table-scroll"><table className="workspace-table">
          <thead>
            <tr>
              <th>Faixa</th>
              {type !== "PAYABLE" ? <th className="money">A receber</th> : null}
              {type !== "RECEIVABLE" ? <th className="money">A pagar</th> : null}
            </tr>
          </thead>
          <tbody>
            {report.totalsByBucket.map((row) => {
              const receivable = byType.RECEIVABLE.get(row.bucket) ?? BigInt(0);
              const payable = byType.PAYABLE.get(row.bucket) ?? BigInt(0);
              return <tr key={row.bucket}>
                <td>{BUCKET_LABEL[row.bucket] ?? row.bucket}</td>
                {type !== "PAYABLE" ? <td className="money"><div className="workspace-aging-value"><span>{formatCents(receivable)}</span><i aria-hidden="true" style={{ width: `${percentOf(receivable, receivableCents)}%` }} /></div></td> : null}
                {type !== "RECEIVABLE" ? <td className="money"><div className="workspace-aging-value"><span>{formatCents(payable)}</span><i aria-hidden="true" style={{ width: `${percentOf(payable, payableCents)}%` }} /></div></td> : null}
              </tr>;
            })}
          </tbody>
          <tfoot>
            <tr>
              <td style={{ fontWeight: 700 }}>Total por tipo</td>
              {type !== "PAYABLE" ? <td className="money" style={{ fontWeight: 700 }}>{formatCents(receivableCents)}</td> : null}
              {type !== "RECEIVABLE" ? <td className="money" style={{ fontWeight: 700 }}>{formatCents(payableCents)}</td> : null}
            </tr>
          </tfoot>
        </table></div>
      </div>

      <div className="card">
        <h2>Títulos em aberto</h2>
        {report.entries.length === 0 ? (
          <div className="workspace-empty"><strong>Nada em aberto para esta seleção</strong><p>Experimente outra data de referência ou tipo de título.</p></div>
        ) : (
          <div className="table-scroll"><table className="workspace-table">
            <thead>
              <tr>
                <th>Vencimento</th>
                <th>Tipo</th>
                <th>Descrição</th>
                <th>Categoria</th>
                <th className="money">Saldo aberto</th>
                <th>Faixa</th>
              </tr>
            </thead>
            <tbody>
              {report.entries.map((entry) => (
                <tr key={entry.titleId}>
                  <td>{formatDateOnly(entry.dueDate)}</td>
                  <td>{entry.type === "RECEIVABLE" ? "Entrada" : "Saída"}</td>
                  <td><Link href={`/${entry.type === "RECEIVABLE" ? "entradas" : "saidas"}/${entry.titleId}`}>{entry.description}</Link></td>
                  <td>{entry.categoryName}</td>
                  <td className="money">{formatCents(entry.remainingCents)}</td>
                  <td>{BUCKET_LABEL[entry.bucket] ?? entry.bucket}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>
    </main>
  );
}
