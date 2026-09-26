import { redirect } from "next/navigation";
import { listFinancialAccounts } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { createTransferAction } from "../actions";

export default async function NovaTransferenciaPage({
  searchParams,
}: {
  searchParams: { erro?: string };
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const company = await requirePrimaryCompany(user.id);

  const accounts = await listFinancialAccounts(user.id, company.id);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <main>
      <h1 style={{ marginBottom: "1rem" }}>Nova transferência</h1>

      <div className="card">
        {searchParams.erro ? <p className="error">{searchParams.erro}</p> : null}

        {accounts.length < 2 ? (
          <p className="muted">
            Você precisa de pelo menos duas contas para transferir entre elas.{" "}
            <a href="/contas">Cadastre outra conta</a>.
          </p>
        ) : (
          <form action={createTransferAction}>
            <div className="form-grid">
              <div>
                <label htmlFor="fromAccountId">Conta de origem</label>
                <select id="fromAccountId" name="fromAccountId" required defaultValue="">
                  <option value="" disabled>
                    Selecione
                  </option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="toAccountId">Conta de destino</label>
                <select id="toAccountId" name="toAccountId" required defaultValue="">
                  <option value="" disabled>
                    Selecione
                  </option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="amount">Valor (R$)</label>
                <input
                  id="amount"
                  name="amount"
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  required
                />
              </div>

              <div>
                <label htmlFor="fee">Tarifa (R$)</label>
                <input
                  id="fee"
                  name="fee"
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  defaultValue="0,00"
                />
              </div>

              <div>
                <label htmlFor="transferDate">Data</label>
                <input id="transferDate" name="transferDate" type="date" defaultValue={today} required />
              </div>

              <div>
                <label htmlFor="description">Descrição</label>
                <input id="description" name="description" type="text" maxLength={500} />
              </div>
            </div>

            <button type="submit">Transferir</button>
          </form>
        )}
      </div>
    </main>
  );
}
