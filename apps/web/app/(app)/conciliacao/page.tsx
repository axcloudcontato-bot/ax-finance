import { redirect } from "next/navigation";
import {
  listBankStatementLines,
  listFinancialAccounts,
  listUnreconciledSettlements,
} from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { formatCents } from "@/lib/currency";
import { formatDateOnly } from "@/lib/dates";
import {
  ignoreLineAction,
  importBankStatementAction,
  reconcileLineAction,
  undoReconciliationAction,
} from "./actions";
import { resolvePeriodRange } from "@/lib/month";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendente",
  RECONCILED: "Conciliado",
  IGNORED: "Ignorado",
};

export default async function ConciliacaoPage({
  searchParams,
}: {
  searchParams: {
    conta?: string;
    status?: string;
    erro?: string;
    importado?: string;
    duplicado?: string;
    invalido?: string;
    mes?: string;
    de?: string;
    ate?: string;
  };
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const company = await requirePrimaryCompany(user.id);

  const accounts = await listFinancialAccounts(user.id, company.id);
  const activeAccountId = searchParams.conta ?? accounts[0]?.id;

  if (!activeAccountId) {
    return (
      <main className="wide">
        <h1 style={{ marginBottom: "1rem" }}>Conciliação</h1>
        <div className="card">
          <p className="muted">Cadastre uma conta antes de importar um extrato.</p>
        </div>
      </main>
    );
  }

  const statusFilter = (searchParams.status as "PENDING" | "RECONCILED" | "IGNORED" | undefined) ?? undefined;
  const period = resolvePeriodRange(searchParams);

  const [lines, unreconciledSettlements] = await Promise.all([
    listBankStatementLines(user.id, company.id, { financialAccountId: activeAccountId, status: statusFilter, ...period }),
    listUnreconciledSettlements(user.id, company.id, activeAccountId),
  ]);

  const periodQuery = period.mode === "custom"
    ? `de=${period.from}&ate=${period.to}`
    : `mes=${period.month}`;
  const accountHref = (accountId: string) => `/conciliacao?conta=${accountId}&${periodQuery}`;
  const statusHref = (status?: string) =>
    `/conciliacao?conta=${activeAccountId}${status ? `&status=${status}` : ""}&${periodQuery}`;

  return (
    <main className="wide">
      <h1 style={{ marginBottom: "1rem" }}>Conciliação</h1>

      <div className="filters">
        {accounts.map((account) => (
          <a key={account.id} href={accountHref(account.id)} className={account.id === activeAccountId ? "active" : ""}>
            {account.name}
          </a>
        ))}
      </div>

      <div className="card">
        <h1>Importar extrato</h1>
        <p className="subtitle">
          CSV com cabeçalho <code>data,descricao,valor</code> — data em <code>DD/MM/AAAA</code> ou{" "}
          <code>AAAA-MM-DD</code>, valor negativo para saída. Reimportar o mesmo arquivo não
          duplica linhas.
        </p>

        {searchParams.erro ? <p className="error">{searchParams.erro}</p> : null}
        {searchParams.importado ? (
          <p className="subtitle">
            {searchParams.importado} importada(s) · {searchParams.duplicado} duplicada(s) ·{" "}
            {searchParams.invalido} inválida(s).
          </p>
        ) : null}

        <form action={importBankStatementAction}>
          <input type="hidden" name="financialAccountId" value={activeAccountId} />
          <label htmlFor="file">Arquivo CSV</label>
          <input id="file" name="file" type="file" accept=".csv,text/csv" required />
          <button type="submit">Importar</button>
        </form>
      </div>

      <div className="card">
        <div className="page-header" style={{ marginBottom: "0.5rem" }}>
          <h1>Linhas do extrato</h1>
        </div>

        <div className="filters">
          <a href={statusHref(undefined)} className={!statusFilter ? "active" : ""}>
            Todas
          </a>
          <a href={statusHref("PENDING")} className={statusFilter === "PENDING" ? "active" : ""}>
            Pendentes
          </a>
          <a href={statusHref("RECONCILED")} className={statusFilter === "RECONCILED" ? "active" : ""}>
            Conciliadas
          </a>
          <a href={statusHref("IGNORED")} className={statusFilter === "IGNORED" ? "active" : ""}>
            Ignoradas
          </a>
        </div>

        {lines.length === 0 ? (
          <p className="muted">Nenhuma linha nessa conta/filtro ainda.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Descrição</th>
                <th>Valor</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.id}>
                  <td>{formatDateOnly(line.lineDate)}</td>
                  <td>{line.description}</td>
                  <td>{formatCents(line.amountCents)}</td>
                  <td>
                    {STATUS_LABEL[line.status] ?? line.status}
                    {line.status === "IGNORED" && line.ignoreReason ? (
                      <p className="muted" style={{ margin: 0 }}>
                        {line.ignoreReason}
                      </p>
                    ) : null}
                    {line.status === "RECONCILED" && line.reconciledSettlement ? (
                      <p className="muted" style={{ margin: 0 }}>
                        {line.reconciledSettlement.title.description}
                      </p>
                    ) : null}
                  </td>
                  <td>
                    {line.status === "PENDING" ? (
                      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                        <form action={reconcileLineAction} className="inline">
                          <input type="hidden" name="lineId" value={line.id} />
                          <input type="hidden" name="financialAccountId" value={activeAccountId} />
                          <select name="settlementId" required defaultValue="" style={{ width: "auto" }}>
                            <option value="" disabled>
                              Conciliar com...
                            </option>
                            {unreconciledSettlements.map((settlement) => (
                              <option key={settlement.id} value={settlement.id}>
                                {formatDateOnly(settlement.effectiveDate)} ·{" "}
                                {settlement.title.description} ·{" "}
                                {formatCents(settlement.principalAmountCents)}
                              </option>
                            ))}
                          </select>
                          <button type="submit" className="secondary" style={{ marginTop: 0 }}>
                            Conciliar
                          </button>
                        </form>
                        <form action={ignoreLineAction} className="inline">
                          <input type="hidden" name="lineId" value={line.id} />
                          <input type="hidden" name="financialAccountId" value={activeAccountId} />
                          <input type="text" name="reason" placeholder="Motivo" style={{ width: "auto" }} required />
                          <button type="submit" className="secondary" style={{ marginTop: 0 }}>
                            Ignorar
                          </button>
                        </form>
                      </div>
                    ) : (
                      <form action={undoReconciliationAction} className="inline">
                        <input type="hidden" name="lineId" value={line.id} />
                        <input type="hidden" name="financialAccountId" value={activeAccountId} />
                        <button type="submit" className="secondary">
                          Desfazer
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
