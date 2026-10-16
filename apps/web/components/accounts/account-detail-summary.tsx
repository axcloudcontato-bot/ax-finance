import Link from "next/link";
import type { AccountMovement, listFinancialAccountsWithBalance } from "@ax-finance/domain";
import { formatCents } from "@/lib/currency";
import { formatDateOnly } from "@/lib/dates";

type Account = Awaited<ReturnType<typeof listFinancialAccountsWithBalance>>[number];

export const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  BANK: "Conta bancária",
  CASH: "Dinheiro em caixa",
  WALLET: "Carteira de recebimentos",
};

const KIND_LABEL: Record<AccountMovement["kind"], string> = {
  SETTLEMENT: "Baixa",
  REFUND: "Devolução",
  TRANSFER_OUT: "Transferência enviada",
  TRANSFER_IN: "Transferência recebida",
  ADJUSTMENT: "Ajuste",
};

/**
 * Detalhe da conta ou carteira no modal: saldo atual, como ele se forma e os últimos movimentos
 * efetivados (baixas, devoluções, transferências e ajustes).
 */
export function AccountDetailSummary({ account, movements }: { account: Account; movements: AccountMovement[] }) {
  const variation = account.currentBalanceCents - account.openingBalanceCents;
  return (
    <div className="detail-summary">
      <p className="subtitle">
        {ACCOUNT_TYPE_LABEL[account.type] ?? account.type} · {account.status === "ACTIVE" ? "ativa" : "arquivada"} · {account.includedInAvailableTotal && account.status === "ACTIVE" ? "entra no saldo disponível" : "fora do saldo disponível"}
      </p>
      <dl className="goal-detail-facts">
        <div><dt>Saldo atual</dt><dd className={account.currentBalanceCents < BigInt(0) ? "negative" : undefined}>{formatCents(account.currentBalanceCents, account.currency)}</dd></div>
        <div><dt>Saldo de abertura</dt><dd>{formatCents(account.openingBalanceCents, account.currency)}</dd><small>em {formatDateOnly(account.openingDate)}</small></div>
        <div><dt>Variação desde a abertura</dt><dd className={variation < BigInt(0) ? "negative" : variation > BigInt(0) ? "positive" : undefined}>{variation > BigInt(0) ? "+" : ""}{formatCents(variation, account.currency)}</dd></div>
      </dl>

      <h3 className="detail-summary-heading">Últimos movimentos</h3>
      {movements.length === 0 ? <p className="muted">Nenhum movimento efetivado nesta conta ainda.</p> : (
        <ul className="detail-summary-list">
          {movements.map((movement, index) => {
            const body = (
              <>
                <span><strong>{movement.description}</strong><small>{formatDateOnly(movement.date)} · {KIND_LABEL[movement.kind]}</small></span>
                <em className={movement.cents < BigInt(0) ? "negative" : "positive"}>{movement.cents > BigInt(0) ? "+" : ""}{formatCents(movement.cents, account.currency)}</em>
              </>
            );
            const href = movement.titleId ? `/${movement.titleType === "RECEIVABLE" ? "entradas" : "saidas"}/${movement.titleId}` : null;
            return <li key={`${movement.kind}-${movement.date}-${index}`}>{href ? <Link href={href}>{body}</Link> : <div>{body}</div>}</li>;
          })}
        </ul>
      )}

      <div className="form-actions">
        <Link href="/transferencias" className="button-link">Transferir entre contas</Link>
      </div>
    </div>
  );
}
