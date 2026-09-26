import { redirect } from "next/navigation";
import { listPeriodClosures } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { addMonths, currentYearMonth, monthLabel } from "@/lib/month";
import { closePeriodAction, reopenPeriodAction } from "./actions";

export default async function FechamentoPage({
  searchParams,
}: {
  searchParams: { erro?: string; fechado?: string; reaberto?: string };
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const company = await requirePrimaryCompany(user.id);

  const closures = await listPeriodClosures(user.id, company.id);
  const closureByPeriod = new Map(closures.map((closure) => [closure.period, closure]));

  const now = currentYearMonth();
  const periods = Array.from({ length: 12 }, (_, index) => addMonths(now, -index));

  return (
    <main className="wide">
      <h1 style={{ marginBottom: "1rem" }}>Fechamento de período</h1>
      <p className="subtitle">
        Fechar um período bloqueia novas baixas e estornos com data efetiva naquele mês. Título
        novo, cancelamento e transferências não são afetados nesta etapa.
      </p>

      {searchParams.erro ? <p className="error">{searchParams.erro}</p> : null}
      {searchParams.fechado ? <p className="subtitle">Período {searchParams.fechado} fechado.</p> : null}
      {searchParams.reaberto ? <p className="subtitle">Período {searchParams.reaberto} reaberto.</p> : null}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Mês</th>
              <th>Status</th>
              <th>Detalhe</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {periods.map((period) => {
              const closure = closureByPeriod.get(period);
              const isClosed = closure?.status === "CLOSED";

              return (
                <tr key={period}>
                  <td>{monthLabel(period)}</td>
                  <td>{isClosed ? "Fechado" : closure?.status === "REOPENED" ? "Reaberto" : "Aberto"}</td>
                  <td>
                    {isClosed && closure ? (
                      <p className="muted" style={{ margin: 0 }}>
                        Fechado em {new Date(closure.closedAt).toLocaleDateString("pt-BR")}
                      </p>
                    ) : closure?.reopenReason ? (
                      <p className="muted" style={{ margin: 0 }}>
                        Reaberto: {closure.reopenReason}
                      </p>
                    ) : null}
                  </td>
                  <td>
                    {isClosed ? (
                      <form action={reopenPeriodAction} className="inline" style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                        <input type="hidden" name="period" value={period} />
                        <input type="text" name="reason" placeholder="Motivo da reabertura" style={{ width: "auto" }} required />
                        <button type="submit" className="secondary" style={{ marginTop: 0 }}>
                          Reabrir
                        </button>
                      </form>
                    ) : (
                      <form action={closePeriodAction} className="inline">
                        <input type="hidden" name="period" value={period} />
                        <button type="submit" className="secondary">
                          Fechar
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
