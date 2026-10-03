import { randomUUID } from "node:crypto";
import type { listFinancialAccounts } from "@ax-finance/domain";
import { SubmitButton } from "@/components/ui/submit-button";

type AccountOption = Awaited<ReturnType<typeof listFinancialAccounts>>[number];

export function SettlementForm({
  action,
  accounts,
  error,
  submitLabel = "Registrar baixa",
}: {
  action: (formData: FormData) => void | Promise<void>;
  accounts: AccountOption[];
  error?: string;
  submitLabel?: string;
}) {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      {error ? <p className="error">{error}</p> : null}

      {accounts.length === 0 ? (
        <p className="muted">Cadastre uma conta antes de registrar uma baixa.</p>
      ) : (
        <form action={action}>
          <input type="hidden" name="idempotencyKey" value={randomUUID()} />
          <label htmlFor="financialAccountId">Conta</label>
          <select id="financialAccountId" name="financialAccountId" required defaultValue="">
            <option value="" disabled>
              Selecione
            </option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>

          <label htmlFor="principalAmount">Valor recebido/pago (R$)</label>
          <input
            id="principalAmount"
            name="principalAmount"
            type="text"
            inputMode="decimal"
            placeholder="0,00"
            required
          />

          <label htmlFor="discountAmount">Desconto concedido (R$)</label>
          <input
            id="discountAmount"
            name="discountAmount"
            type="text"
            inputMode="decimal"
            placeholder="0,00"
            defaultValue="0,00"
          />

          <label htmlFor="interestPenaltyAmount">Juros/multa (R$)</label>
          <input
            id="interestPenaltyAmount"
            name="interestPenaltyAmount"
            type="text"
            inputMode="decimal"
            placeholder="0,00"
            defaultValue="0,00"
          />

          <label htmlFor="feesAmount">Taxas retidas (R$)</label>
          <input
            id="feesAmount"
            name="feesAmount"
            type="text"
            inputMode="decimal"
            placeholder="0,00"
            defaultValue="0,00"
          />

          <label htmlFor="effectiveDate">Data efetiva</label>
          <input id="effectiveDate" name="effectiveDate" type="date" defaultValue={today} required />

          <label htmlFor="paymentMethod">Meio de pagamento</label>
          <input id="paymentMethod" name="paymentMethod" type="text" maxLength={100} />

          <SubmitButton>{submitLabel}</SubmitButton>
        </form>
      )}
    </>
  );
}
