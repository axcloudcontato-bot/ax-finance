import { randomUUID } from "node:crypto";
import { PAYMENT_METHOD_LABEL, paymentMethodLabel, type listFinancialAccounts } from "@ax-finance/domain";
import { SubmitButton } from "@/components/ui/submit-button";
import { todayDateOnlyString } from "@/lib/dates";
import { LateChargeSuggester } from "./late-charge-suggester";

type AccountOption = Awaited<ReturnType<typeof listFinancialAccounts>>[number];

export interface SettlementDefaults {
  /** Conta prevista no lançamento (ou a única conta ativa). */
  financialAccountId?: string | null;
  /** Valor sugerido do principal, no formato do campo ("1.234,56"): normalmente o saldo em aberto. */
  principal?: string;
  /** Forma de pagamento prevista no lançamento. */
  paymentMethod?: string | null;
  /** Multa e juros sugeridos para recebível atrasado ("25,00") e a explicação mostrada ao lado. */
  interestPenalty?: string;
  suggestionNote?: string;
  /** Recebível: sugere multa e juros e recalcula ao mudar a data ou o valor. Substitui a sugestão fixa acima. */
  lateCharge?: { dueDate: string; lateFeeBps: number; lateInterestMonthlyBps: number };
}

export function SettlementForm({
  action,
  accounts,
  error,
  submitLabel = "Registrar baixa",
  defaults = {},
}: {
  action: (formData: FormData) => void | Promise<void>;
  accounts: AccountOption[];
  error?: string;
  submitLabel?: string;
  defaults?: SettlementDefaults;
}) {
  const today = todayDateOnlyString();
  const initialAccount = defaults.financialAccountId && accounts.some((account) => account.id === defaults.financialAccountId)
    ? defaults.financialAccountId
    : accounts.length === 1 ? accounts[0]!.id : "";
  const methodLabel = paymentMethodLabel(defaults.paymentMethod) ?? "";
  const knownMethods = Object.values(PAYMENT_METHOD_LABEL);

  return (
    <>
      {error ? <p className="error">{error}</p> : null}

      {accounts.length === 0 ? (
        <p className="muted">Cadastre uma conta antes de registrar uma baixa.</p>
      ) : (
        <form action={action}>
          <input type="hidden" name="idempotencyKey" value={randomUUID()} />
          <div className="form-grid">
            <div className="span-2">
              <label htmlFor="financialAccountId">Conta</label>
              <select id="financialAccountId" name="financialAccountId" required defaultValue={initialAccount}>
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
              <label htmlFor="principalAmount">Valor recebido/pago (R$)</label>
              <input id="principalAmount" name="principalAmount" type="text" inputMode="decimal" placeholder="0,00" defaultValue={defaults.principal} required />
            </div>

            <div>
              <label htmlFor="effectiveDate">Data efetiva</label>
              <input id="effectiveDate" name="effectiveDate" type="date" defaultValue={today} required />
            </div>

            <div>
              <label htmlFor="interestPenaltyAmount">Juros/multa (R$)</label>
              <input id="interestPenaltyAmount" name="interestPenaltyAmount" type="text" inputMode="decimal" placeholder="0,00" defaultValue={defaults.interestPenalty ?? "0,00"} />
              {defaults.lateCharge ? <LateChargeSuggester {...defaults.lateCharge} /> : defaults.suggestionNote ? <p className="field-note">{defaults.suggestionNote}</p> : null}
            </div>

            <div>
              <label htmlFor="discountAmount">Desconto concedido (R$)</label>
              <input id="discountAmount" name="discountAmount" type="text" inputMode="decimal" placeholder="0,00" defaultValue="0,00" />
            </div>

            <div>
              <label htmlFor="feesAmount">Taxas retidas (R$)</label>
              <input id="feesAmount" name="feesAmount" type="text" inputMode="decimal" placeholder="0,00" defaultValue="0,00" />
            </div>

            <div>
              <label htmlFor="paymentMethod">Meio de pagamento</label>
              <select id="paymentMethod" name="paymentMethod" defaultValue={methodLabel}>
                <option value="">Não informar</option>
                {methodLabel && !knownMethods.includes(methodLabel) ? <option value={methodLabel}>{methodLabel}</option> : null}
                {knownMethods.map((label) => <option key={label} value={label}>{label}</option>)}
              </select>
            </div>
          </div>

          <div className="form-actions">
            <SubmitButton>{submitLabel}</SubmitButton>
          </div>
        </form>
      )}
    </>
  );
}
