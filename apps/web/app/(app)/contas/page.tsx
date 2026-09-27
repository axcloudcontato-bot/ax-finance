import { randomUUID } from "node:crypto";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Landmark, Scale } from "lucide-react";
import { listBalanceAdjustments, listFinancialAccountsWithBalance } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { formatCents } from "@/lib/currency";
import { formatDateOnly } from "@/lib/dates";
import { ActionModal } from "@/components/ui/action-modal";
import { Modal } from "@/components/ui/modal";
import { createAccountAction, createBalanceAdjustmentAction, reverseBalanceAdjustmentAction, setAccountArchivedAction, updateAccountAction } from "./actions";
import { resolvePeriodRange } from "@/lib/month";

const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  BANK: "Conta bancária",
  CASH: "Dinheiro em caixa",
  WALLET: "Carteira de recebimentos",
};

export default async function ContasPage({
  searchParams,
}: {
  searchParams: {
    erro?: string;
    criado?: string;
    erroAjuste?: string;
    contaAjuste?: string;
    ajustado?: string;
    erroEstorno?: string;
    mes?: string;
    de?: string;
    ate?: string;
    periodo?: string;
    comparar?: string;
    erroConta?: string;
    contaAtualizada?: string;
  };
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const company = await requirePrimaryCompany(user.id);

  const period = resolvePeriodRange(searchParams);
  const [accounts, adjustments] = await Promise.all([
    listFinancialAccountsWithBalance(user.id, company.id),
    listBalanceAdjustments(user.id, company.id, period),
  ]);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <main className="wide">
      <div className="page-header">
        <h1>Contas</h1>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <Link href="/transferencias" className="button-link">
            Transferir entre contas
          </Link>
          <Modal
            triggerLabel="+ Nova conta"
            title="Nova conta"
            icon={<Landmark className="size-5" strokeWidth={1.5} />}
          >
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
          </Modal>
        </div>
      </div>

      <div className="card">
          {searchParams.erroConta ? <p className="error">{searchParams.erroConta}</p> : null}
          {searchParams.contaAtualizada ? <p className="success-box">Conta atualizada.</p> : null}
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
                  <th>Status</th>
                  <th></th>
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
                    <td>{account.status === "ACTIVE" ? "Ativa" : "Arquivada"}</td>
                    <td>
                      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                      <ActionModal triggerLabel="Editar" title={`Editar conta — ${account.name}`}>
                        <form action={updateAccountAction.bind(null, account.id)}>
                          <label htmlFor={`name-${account.id}`}>Nome</label>
                          <input id={`name-${account.id}`} name="name" defaultValue={account.name} required maxLength={200} />
                          <label htmlFor={`type-${account.id}`}>Tipo</label>
                          <select id={`type-${account.id}`} name="type" defaultValue={account.type}>
                            <option value="BANK">Conta bancária</option><option value="CASH">Dinheiro em caixa</option><option value="WALLET">Carteira de recebimentos</option>
                          </select>
                          <label><input type="checkbox" name="includedInAvailableTotal" value="true" defaultChecked={account.includedInAvailableTotal} /> Incluir no saldo disponível</label>
                          <button type="submit">Salvar alterações</button>
                        </form>
                      </ActionModal>
                      {account.status === "ACTIVE" ? <ActionModal
                        key={searchParams.ajustado ?? "novo"}
                        triggerLabel="Ajustar saldo"
                        title={`Ajustar saldo — ${account.name}`}
                        icon={<Scale className="size-5" strokeWidth={1.5} />}
                        initiallyOpen={Boolean(searchParams.erroAjuste) && searchParams.contaAjuste === account.id}
                      >
                        <p className="subtitle">
                          Saldo atual: {formatCents(account.currentBalanceCents, account.currency)}. Informe o
                          saldo real (ex.: do extrato) — o sistema calcula o ajuste sozinho.
                        </p>
                        {searchParams.contaAjuste === account.id && searchParams.erroAjuste ? (
                          <p className="error">{searchParams.erroAjuste}</p>
                        ) : null}
                        <form action={createBalanceAdjustmentAction.bind(null, account.id)}>
                          <input type="hidden" name="idempotencyKey" value={randomUUID()} />
                          <label htmlFor={`targetBalance-${account.id}`}>Saldo real (R$)</label>
                          <input
                            id={`targetBalance-${account.id}`}
                            name="targetBalance"
                            type="text"
                            inputMode="decimal"
                            placeholder="0,00"
                            required
                          />

                          <label htmlFor={`effectiveDate-${account.id}`}>Data</label>
                          <input
                            id={`effectiveDate-${account.id}`}
                            name="effectiveDate"
                            type="date"
                            defaultValue={today}
                            required
                          />

                          <label htmlFor={`reason-${account.id}`}>Motivo</label>
                          <input id={`reason-${account.id}`} name="reason" type="text" maxLength={500} required />

                          <button type="submit">Ajustar saldo</button>
                        </form>
                      </ActionModal> : null}
                      <form action={setAccountArchivedAction.bind(null, account.id, account.status === "ACTIVE")} className="inline">
                        <button type="submit" className="secondary">{account.status === "ACTIVE" ? "Arquivar" : "Reativar"}</button>
                      </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>

      <div className="card">
        <h1>Histórico de ajustes de saldo</h1>
        {searchParams.erroEstorno ? <p className="error">{searchParams.erroEstorno}</p> : null}
        {adjustments.length === 0 ? (
          <p className="muted">Nenhum ajuste registrado ainda.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Conta</th>
                <th>Ajuste</th>
                <th>Motivo</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {adjustments.map((adjustment) => (
                <tr key={adjustment.id} style={adjustment.reversedAt ? { opacity: 0.5 } : undefined}>
                  <td>{formatDateOnly(adjustment.effectiveDate)}</td>
                  <td>{adjustment.financialAccount.name}</td>
                  <td>
                    {formatCents(adjustment.amountCents, adjustment.financialAccount.currency)}
                  </td>
                  <td>{adjustment.reversedAt ? `${adjustment.reason} (estornado: ${adjustment.reversalReason})` : adjustment.reason}</td>
                  <td>
                    {adjustment.reversedAt ? (
                      "Estornado"
                    ) : (
                      <form
                        action={reverseBalanceAdjustmentAction.bind(null, adjustment.id)}
                        className="inline"
                      >
                        <input type="hidden" name="reason" value="Estornado pelo usuário" />
                        <button type="submit" className="secondary">
                          Estornar
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
