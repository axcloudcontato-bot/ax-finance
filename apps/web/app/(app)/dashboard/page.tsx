import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CompanyAccessDeniedError,
  assertActiveMembership,
  listCompaniesForUser,
  listFinancialAccountsWithBalance,
  listTitles,
} from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { formatCents } from "@/lib/currency";
import { toDateOnlyString, todayDateOnlyString } from "@/lib/dates";

function summarizeOpenTitles(titles: Awaited<ReturnType<typeof listTitles>>) {
  const today = todayDateOnlyString();

  const open = titles.filter((title) => title.status === "OPEN" || title.status === "PARTIALLY_SETTLED");
  const totalCents = open.reduce((sum, title) => sum + title.remainingCents, BigInt(0));
  const overdueCount = open.filter((title) => toDateOnlyString(title.dueDate) < today).length;

  return { totalCents, overdueCount };
}

const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  BANK: "Conta bancária",
  CASH: "Dinheiro em caixa",
  WALLET: "Carteira de recebimentos",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { empresa?: string };
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const companies = await listCompaniesForUser(user.id);
  if (companies.length === 0) {
    redirect("/onboarding");
  }

  const activeCompanyId = searchParams.empresa ?? companies[0]!.id;

  let accounts: Awaited<ReturnType<typeof listFinancialAccountsWithBalance>>;
  try {
    await assertActiveMembership(user.id, activeCompanyId);
    accounts = await listFinancialAccountsWithBalance(user.id, activeCompanyId);
  } catch (error) {
    if (error instanceof CompanyAccessDeniedError) {
      // Empresa na URL não existe ou não é sua: cai de volta para a primeira
      // que você realmente tem acesso, sem confirmar se o id era válido.
      redirect(`/dashboard?empresa=${companies[0]!.id}`);
    }
    throw error;
  }

  const totalCents = accounts
    .filter((account) => account.includedInAvailableTotal)
    .reduce((sum, account) => sum + account.currentBalanceCents, BigInt(0));

  const [receivables, payables] = await Promise.all([
    listTitles(user.id, activeCompanyId, { type: "RECEIVABLE" }),
    listTitles(user.id, activeCompanyId, { type: "PAYABLE" }),
  ]);
  const toReceive = summarizeOpenTitles(receivables);
  const toPay = summarizeOpenTitles(payables);

  return (
    <main className="wide">
      <div className="card">
        <h1>Saldo das contas</h1>
        <p className="subtitle">
          Saldo de abertura + baixas de títulos + transferências (Seção 18). Ainda não considera
          importação/conciliação bancária.
        </p>
        <p style={{ fontSize: "1.75rem", fontWeight: 700 }}>{formatCents(totalCents)}</p>
      </div>

      <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
        <div className="card" style={{ flex: "1 1 200px" }}>
          <h1>A receber</h1>
          <p className="subtitle">
            {toReceive.overdueCount > 0
              ? `${toReceive.overdueCount} título(s) vencido(s)`
              : "Nada vencido"}
          </p>
          <p style={{ fontSize: "1.5rem", fontWeight: 700 }}>{formatCents(toReceive.totalCents)}</p>
          <Link href="/entradas" className="button-link" style={{ marginTop: "0.75rem" }}>
            Ver entradas
          </Link>
        </div>

        <div className="card" style={{ flex: "1 1 200px" }}>
          <h1>A pagar</h1>
          <p className="subtitle">
            {toPay.overdueCount > 0 ? `${toPay.overdueCount} título(s) vencido(s)` : "Nada vencido"}
          </p>
          <p style={{ fontSize: "1.5rem", fontWeight: 700 }}>{formatCents(toPay.totalCents)}</p>
          <Link href="/saidas" className="button-link" style={{ marginTop: "0.75rem" }}>
            Ver saídas
          </Link>
        </div>
      </div>

      <div className="card">
        <div className="page-header" style={{ marginBottom: "0.5rem" }}>
          <h1>Contas</h1>
          <Link href="/contas" className="button-link">
            Gerenciar contas
          </Link>
        </div>
        {accounts.length === 0 ? (
          <p className="muted">Nenhuma conta cadastrada ainda.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Tipo</th>
                <th>Saldo atual</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.id}>
                  <td>{account.name}</td>
                  <td>{ACCOUNT_TYPE_LABEL[account.type] ?? account.type}</td>
                  <td style={{ fontWeight: 600 }}>
                    {formatCents(account.currentBalanceCents, account.currency)}
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
