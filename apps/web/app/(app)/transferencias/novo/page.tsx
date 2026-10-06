import { randomUUID } from "node:crypto";
import Link from "next/link";
import { redirect } from "next/navigation";
import { listFinancialAccounts } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { createTransferAction } from "../actions";
import { TransferForm } from "@/components/transfers/transfer-form";
import { todayDateOnlyString } from "@/lib/dates";

export default async function NovaTransferenciaPage(
  props: {
    searchParams: Promise<{ erro?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const company = await requirePrimaryCompany(user.id);

  const accounts = await listFinancialAccounts(user.id, company.id);
  const today = todayDateOnlyString();

  return (
    <main>
      <div className="page-header"><div><h1>Nova transferência</h1><p className="subtitle">Mova dinheiro entre contas da empresa e confira o efeito nos saldos antes de confirmar.</p></div><Link href="/transferencias" className="button-link">← Voltar</Link></div>
      <p className="workspace-method-note">Transferências internas não são receita nem despesa. Apenas a tarifa reduz o saldo total da empresa.</p>

      <div className="card">
        <h2>Dados da movimentação</h2>
        {searchParams.erro ? <p className="error">{searchParams.erro}</p> : null}

        {accounts.length < 2 ? (
          <div className="workspace-empty"><strong>Falta uma segunda conta</strong><p>Cadastre pelo menos duas contas ativas para registrar uma transferência interna.</p><Link href="/contas" className="button-link">Ir para Contas</Link></div>
        ) : (
          <TransferForm accounts={accounts.map(({ id, name }) => ({ id, name }))} action={createTransferAction} today={today} idempotencyKey={randomUUID()} />
        )}
      </div>
    </main>
  );
}
