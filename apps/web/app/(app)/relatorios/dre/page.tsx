import { redirect } from "next/navigation";
import { getManagerialIncomeStatement } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { formatCents } from "@/lib/currency";
import { formatDateOnly } from "@/lib/dates";
import { resolvePeriodRange } from "@/lib/month";

export default async function DrePage({
  searchParams,
}: {
  searchParams: { de?: string; ate?: string; mes?: string };
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const company = await requirePrimaryCompany(user.id);

  const { from, to } = resolvePeriodRange(searchParams);

  const report = await getManagerialIncomeStatement(user.id, company.id, { from, to });
  const exportHref = `/api/reports/dre?de=${from}&ate=${to}`;

  return (
    <main className="wide">
      <h1 style={{ marginBottom: "0.25rem" }}>DRE gerencial básica</h1>
      <p className="muted" style={{ marginBottom: "1rem" }}>
        {company.name} · {formatDateOnly(from)} a {formatDateOnly(to)} · regime de competência ·
        gerado em {new Date().toLocaleString("pt-BR")}
      </p>

      <div className="card">
        <p className="subtitle">
          Usa a competência e o valor original de cada título (não a baixa) — títulos ainda em
          aberto entram no cálculo. Títulos cancelados ficam de fora. Categorias sem grupo
          gerencial definido aparecem agrupadas pela natureza.
        </p>

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
        <h1>Por grupo gerencial</h1>
        {report.groups.length === 0 ? (
          <p className="muted">Nenhum título com competência no período.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Grupo</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              {report.groups.map((group) => (
                <tr key={group.label}>
                  <td>{group.label}</td>
                  <td>{formatCents(group.cents)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td style={{ fontWeight: 700 }}>Resultado gerencial</td>
                <td style={{ fontWeight: 700 }}>{formatCents(report.totalCents)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </main>
  );
}
