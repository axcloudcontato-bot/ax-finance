import Link from "next/link";
import { redirect } from "next/navigation";
import { listFinancialAccountsWithBalance } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { formatCents } from "@/lib/currency";
import { createAccountAction } from "./actions";

const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  BANK: "Conta bancária",
  CASH: "Dinheiro em caixa",
  WALLET: "Carteira de recebimentos",
};

export default async function ContasPage({
  searchParams,
}: {
  searchParams: { erro?: string };
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const company = await requirePrimaryCompany(user.id);

  const accounts = await listFinancialAccountsWithBalance(user.id, company.id);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <main className="wide">
      <div className="page-header">
        <h1>Contas</h1>
        <Link href="/transferencias" className="button-link">
          Transferir entre contas
        </Link>
      </div>

      <div className="split">
        <div className="card">
          {accounts.length === 0 ? (
            <p className="muted">Nenhuma conta cadastrada ainda.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Tipo</th>
                  <th>Saldo de abertura</th>
                  <th>Saldo atual</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((account) => (
                  <tr key={account.id}>
                    <td>{account.name}</td>
                    <td>{ACCOUNT_TYPE_LABEL[account.type] ?? account.type}</td>
                    <td>{formatCents(account.openingBalanceCents, account.currency)}</td>
                    <td style={{ fontWeight: 600 }}>
                      {formatCents(account.currentBalanceCents, account.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <h1>Nova conta</h1>
          {searchParams.erro ? <p className="error">{searchParams.erro}</p> : null}
          <form action={createAccountAction}>
            <label htmlFor="name">Nome</label>
            <input id="name" name="name" type="text" required maxLength={200} />

            <label htmlFor="type">Tipo</label>
            <select id="type" name="type" defaultValue="BANK">
              <option value="BANK">Conta bancária</option>
              <option value="CASH">Dinheiro em caixa</option>
              <option value="WALLET">Carteira de recebimentos</option>
            </select>

            <label htmlFor="openingBalance">Saldo de abertura (R$)</label>
            <input
              id="openingBalance"
              name="openingBalance"
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              defaultValue="0,00"
              required
            />

            <label htmlFor="openingDate">Data do saldo de abertura</label>
            <input id="openingDate" name="openingDate" type="date" defaultValue={today} required />

            <button type="submit">Criar conta</button>
          </form>
        </div>
      </div>
    </main>
  );
}
