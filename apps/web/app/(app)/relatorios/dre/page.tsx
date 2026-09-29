import { redirect } from "next/navigation";
import { getManagerialIncomeStatement } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { formatCents } from "@/lib/currency";
import { formatDateOnly } from "@/lib/dates";
import { resolveComparison, resolvePeriodRange } from "@/lib/month";
import { formatPercentageChange } from "@/lib/comparison";

export default async function DrePage(
  props: {
    searchParams: Promise<{ de?: string; ate?: string; mes?: string; periodo?: string; comparar?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const company = await requirePrimaryCompany(user.id);

  const period = resolvePeriodRange(searchParams);
  const { from, to } = period;
  const comparison = resolveComparison(searchParams, period);

  const [report, comparisonReport] = await Promise.all([
    getManagerialIncomeStatement(user.id, company.id, { from, to }),
    comparison ? getManagerialIncomeStatement(user.id, company.id, comparison) : Promise.resolve(null),
  ]);
  const exportHref = `/api/reports/dre?de=${from}&ate=${to}`;
  const currentByGroup = new Map(report.groups.map((group) => [group.label, group.cents]));
  const comparisonByGroup = new Map(comparisonReport?.groups.map((group) => [group.label, group.cents]) ?? []);
  const groupRows = [...new Set([...currentByGroup.keys(), ...comparisonByGroup.keys()])].map((label) => ({
    label,
    current: currentByGroup.get(label) ?? BigInt(0),
    previous: comparisonByGroup.get(label) ?? BigInt(0),
  }));

  return (
    <main className="wide">
      <h1 style={{ marginBottom: "0.25rem" }}>DRE gerencial básica</h1>
      <p className="muted" style={{ marginBottom: "1rem" }}>
        {company.name} · {formatDateOnly(from)} a {formatDateOnly(to)} · regime de competência ·
        gerado em {new Date().toLocaleString("pt-BR")}
      </p>
      {comparison ? (
        <p className="comparison-banner">
          Comparando com {comparison.label.toLowerCase()}: {formatDateOnly(comparison.from)} a {formatDateOnly(comparison.to)}.
        </p>
      ) : null}

      <div className="card">
        <p className="subtitle">
          Usa a competência e o valor original de cada título (não a baixa) — títulos ainda em
          aberto entram no cálculo. Títulos cancelados ficam de fora. Categorias sem grupo
          gerencial definido aparecem agrupadas pela natureza.
        </p>

        <form method="get" style={{ display: "flex", gap: "1rem", alignItems: "flex-end", flexWrap: "wrap" }}>
          {comparison ? <input type="hidden" name="comparar" value={comparison.mode} /> : null}
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
        <h1>Por grupo gerencial</h1>
        {groupRows.length === 0 ? (
          <p className="muted">Nenhum título com competência no período.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Grupo</th>
                <th>Período atual</th>
                {comparisonReport ? <><th>{comparison?.label}</th><th>Variação</th></> : null}
              </tr>
            </thead>
            <tbody>
              {groupRows.map((group) => (
                <tr key={group.label}>
                  <td>{group.label}</td>
                  <td>{formatCents(group.current)}</td>
                  {comparisonReport ? <><td>{formatCents(group.previous)}</td><td>{formatPercentageChange(group.current, group.previous)}</td></> : null}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td style={{ fontWeight: 700 }}>Resultado gerencial</td>
                <td style={{ fontWeight: 700 }}>{formatCents(report.totalCents)}</td>
                {comparisonReport ? <><td style={{ fontWeight: 700 }}>{formatCents(comparisonReport.totalCents)}</td><td style={{ fontWeight: 700 }}>{formatPercentageChange(report.totalCents, comparisonReport.totalCents)}</td></> : null}
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </main>
  );
}
