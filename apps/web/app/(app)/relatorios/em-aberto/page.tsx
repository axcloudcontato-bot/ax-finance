import Link from "next/link";
import { redirect } from "next/navigation";
import { AGING_BUCKETS, type AgingBucket, getOpenTitlesAgingReport } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { formatCents } from "@/lib/currency";
import { formatDateOnly, todayDateOnlyString } from "@/lib/dates";
import { BUCKET_LABEL } from "@/lib/aging-labels";
import { SubmitButton } from "@/components/ui/submit-button";
import { isDateOnly } from "@/lib/month";
import { ReportNavigation } from "@/components/reports/report-navigation";

export default async function EmAbertoPage(
  props: {
    searchParams: Promise<{ tipo?: string; data?: string; faixa?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const company = await requirePrimaryCompany(user.id);

  const type = searchParams.tipo === "RECEIVABLE" || searchParams.tipo === "PAYABLE" ? searchParams.tipo : undefined;
  const asOfDate = isDateOnly(searchParams.data) ? searchParams.data : todayDateOnlyString();
  const bucket = AGING_BUCKETS.includes(searchParams.faixa as AgingBucket) ? searchParams.faixa as AgingBucket : undefined;

  const report = await getOpenTitlesAgingReport(user.id, company.id, { type, asOfDate, bucket });
  const exportHref = `/api/reports/aging?data=${asOfDate}${type ? `&tipo=${type}` : ""}${bucket ? `&faixa=${bucket}` : ""}`;
  const byType = { RECEIVABLE: new Map<string, bigint>(), PAYABLE: new Map<string, bigint>() };
  for (const entry of report.allEntries) {
    const totals = byType[entry.type];
    totals.set(entry.bucket, (totals.get(entry.bucket) ?? BigInt(0)) + entry.remainingCents);
  }
  const receivableCents = report.allEntries.filter((entry) => entry.type === "RECEIVABLE")
    .reduce((sum, entry) => sum + entry.remainingCents, BigInt(0));
  const payableCents = report.totalCents - receivableCents;
  const upcomingCents = report.totalsByBucket.find((row) => row.bucket === "A_VENCER")?.cents ?? BigInt(0);
  const overdueCents = report.totalCents - upcomingCents;
  const overdueReceivableCents = receivableCents - (byType.RECEIVABLE.get("A_VENCER") ?? BigInt(0));
  const overduePayableCents = payableCents - (byType.PAYABLE.get("A_VENCER") ?? BigInt(0));
  const percentOf = (value: bigint, total: bigint) => total > BigInt(0) ? Number(value * BigInt(100) / total) : 0;

  return (
    <main className="wide reports-page">
      <ReportNavigation active="aging" />
      <div className="page-header"><h1>Contas a receber e a pagar</h1><a href={exportHref} className="button-link">Exportar seleção CSV</a></div>
      <p className="muted" style={{ marginBottom: "1rem" }}>
        {company.name} · saldos em aberto de {formatDateOnly(report.balanceAsOfDate)} · atrasos em relação a {formatDateOnly(asOfDate)} · gerado em{" "}
        {new Date().toLocaleString("pt-BR", { timeZone: company.timezone })}
      </p>
      <p className="report-notice">A data de referência altera as faixas de atraso e os vencimentos previstos. Os saldos são os atuais, com baixas efetivas até hoje; esta tela não reconstrói a carteira histórica. Devoluções movimentam caixa e não reabrem automaticamente o principal.</p>
      {searchParams.data && !isDateOnly(searchParams.data) ? <p role="alert" className="report-notice report-notice-alert">Data inválida. Foi usada a data de hoje; escolha uma data válida para recalcular os atrasos.</p> : null}

      <div className="card">
        <form method="get" className="workspace-report-filters">
          <div>
            <label htmlFor="tipo">Tipo</label>
            <select id="tipo" name="tipo" defaultValue={type ?? ""}>
              <option value="">A receber e a pagar</option>
              <option value="RECEIVABLE">Só a receber</option>
              <option value="PAYABLE">Só a pagar</option>
            </select>
          </div>
          <div><label htmlFor="faixa">Faixa na lista de títulos</label><select id="faixa" name="faixa" defaultValue={bucket ?? ""}><option value="">Todas as faixas</option>{AGING_BUCKETS.map((value) => <option key={value} value={value}>{BUCKET_LABEL[value]}</option>)}</select></div>
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
          <div className="workspace-metric workspace-metric-primary"><span className="workspace-metric-label">{type === "RECEIVABLE" ? "A receber" : "A pagar"}</span><strong>{formatCents(report.totalCents)}</strong><span className="workspace-metric-detail">{report.allEntries.length} títulos · todas as faixas</span></div>
          <div className="workspace-metric workspace-metric-alert"><span className="workspace-metric-label">Vencido</span><strong>{formatCents(overdueCents)}</strong><span className="workspace-metric-detail">Vencimento anterior a {formatDateOnly(asOfDate)}</span></div>
          <div className="workspace-metric"><span className="workspace-metric-label">A vencer</span><strong>{formatCents(upcomingCents)}</strong><span className="workspace-metric-detail">Vencimentos na data ou depois</span></div>
        </section>
      ) : (
        <section className="workspace-metrics report-metrics-four" aria-label="Resumo das contas a receber e a pagar">
          <div className="workspace-metric workspace-metric-primary"><span className="workspace-metric-label">A receber</span><strong>{formatCents(receivableCents)}</strong><span className="workspace-metric-detail">Direitos ainda não recebidos</span></div>
          <div className="workspace-metric"><span className="workspace-metric-label">A pagar</span><strong>{formatCents(payableCents)}</strong><span className="workspace-metric-detail">Obrigações ainda não pagas</span></div>
          <div className="workspace-metric workspace-metric-alert"><span className="workspace-metric-label">A receber vencido</span><strong>{formatCents(overdueReceivableCents)}</strong><span className="workspace-metric-detail">{percentOf(overdueReceivableCents, receivableCents)}% da carteira a receber · priorize cobranças</span></div>
          <div className="workspace-metric workspace-metric-alert"><span className="workspace-metric-label">A pagar vencido</span><strong>{formatCents(overduePayableCents)}</strong><span className="workspace-metric-detail">{percentOf(overduePayableCents, payableCents)}% das obrigações · revise encargos e datas</span></div>
        </section>
      )}

      <div className="card"><h2>Agenda de vencimentos</h2><p className="report-caption">Totais cumulativos desde {formatDateOnly(asOfDate)}, excluindo vencidos; incluem principal de faturas de cartão. São compromissos previstos, sem pressupor recebimento garantido.</p><div className="table-scroll"><table className="workspace-table"><thead><tr><th scope="col">Horizonte</th>{type !== "PAYABLE" ? <th scope="col" className="money">A receber</th> : null}{type !== "RECEIVABLE" ? <th scope="col" className="money">A pagar</th> : null}{!type ? <th scope="col" className="money">Receber menos pagar</th> : null}</tr></thead><tbody>{report.schedule.map((row) => <tr key={row.days}><td>{row.days === 0 ? "Na data de referência" : `Até ${formatDateOnly(row.through)} (${row.days} dias)`}</td>{type !== "PAYABLE" ? <td className="money">{formatCents(row.receivableCents)}</td> : null}{type !== "RECEIVABLE" ? <td className="money">{formatCents(row.payableCents)}</td> : null}{!type ? <td className="money">{formatCents(row.receivableCents - row.payableCents)}</td> : null}</tr>)}</tbody></table></div><Link href="/relatorios/fluxo-de-caixa#cash-projection-heading">Analisar impacto no saldo de caixa</Link></div>

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
                <td><Link href={`?${new URLSearchParams({ data: asOfDate, faixa: row.bucket, ...(type ? { tipo: type } : {}) })}`}>{BUCKET_LABEL[row.bucket] ?? row.bucket}</Link></td>
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
        <h2>Títulos em aberto{bucket ? ` · ${BUCKET_LABEL[bucket]}` : ""}</h2>
        <p className="report-caption">{report.entries.length} {report.entries.length === 1 ? "título" : "títulos"} na lista · {formatCents(report.selectedTotalCents)} em principal{!type ? " (soma de direitos e obrigações; não é saldo de caixa)" : ""}. Os resumos acima abrangem todas as faixas do tipo escolhido.</p>
        {report.entries.length === 0 ? (
          <div className="workspace-empty"><strong>Nada em aberto para esta seleção</strong><p>Consulte outro tipo ou faixa. Mudar a data apenas recalcula os atrasos da carteira atual.</p></div>
        ) : (
          <div className="table-scroll"><table className="workspace-table">
            <thead>
              <tr>
                <th>Vencimento</th>
                <th>Tipo</th>
                <th>Descrição</th>
                <th>Categoria</th>
                <th>Cliente/fornecedor</th>
                <th>Centro de custo</th>
                <th className="money">Saldo aberto</th>
                <th>Faixa</th>
              </tr>
            </thead>
            <tbody>
              {report.entries.map((entry) => (
                <tr key={entry.titleId}>
                  <td>{formatDateOnly(entry.dueDate)}</td>
                  <td>{entry.type === "RECEIVABLE" ? "A receber" : "A pagar"}</td>
                  <td><Link href={`/${entry.type === "RECEIVABLE" ? "entradas" : "saidas"}/${entry.titleId}`}>{entry.description}</Link></td>
                  <td>{entry.categoryName}</td>
                  <td>{entry.partyName ?? "Não informado"}</td>
                  <td>{entry.costCenterName ?? "Não informado"}</td>
                  <td className="money">{formatCents(entry.remainingCents)}</td>
                  <td>{entry.daysLate > 0 ? `${entry.daysLate} dias de atraso` : entry.dueDate.toISOString().slice(0, 10) === asOfDate ? "Vence na referência" : "A vencer"}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>
    </main>
  );
}
