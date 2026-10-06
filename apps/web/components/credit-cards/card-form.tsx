import { CREDIT_CARD_ISSUERS } from "@ax-finance/domain";
import { SubmitButton } from "@/components/ui/submit-button";

export const BRAND_LABEL: Record<string, string> = {
  VISA: "Visa",
  MASTERCARD: "Mastercard",
  ELO: "Elo",
  AMEX: "American Express",
  HIPERCARD: "Hipercard",
  OTHER: "Outra",
};

interface CardDefaults {
  name: string;
  brand: string;
  issuer: string | null;
  lastDigits: string | null;
  limitCents: bigint;
  closingDay: number;
  dueDay: number;
  defaultPaymentAccountId: string | null;
}

/** Valor em reais para o campo de texto, no formato que o leitor de valores aceita ("1500,00"). */
function toInputAmount(cents: bigint): string {
  return (Number(cents) / 100).toFixed(2).replace(".", ",");
}

/** Formulário de cadastro/edição do cartão. Server component: serve dentro de modais. */
export function CardForm({
  action,
  accounts,
  defaults,
  idPrefix = "card",
  submitLabel = "Salvar cartão",
}: {
  action: (formData: FormData) => void | Promise<void>;
  accounts: { id: string; name: string }[];
  defaults?: CardDefaults;
  idPrefix?: string;
  submitLabel?: string;
}) {
  return (
    <form action={action}>
      <div className="form-grid">
        <div className="span-2">
          <label htmlFor={`${idPrefix}-name`}>Apelido do cartão</label>
          <input id={`${idPrefix}-name`} name="name" type="text" required maxLength={100} placeholder="Ex.: Nubank, Itaú Platinum" defaultValue={defaults?.name} />
        </div>

        <div className="span-2">
          <label htmlFor={`${idPrefix}-issuer`}>Banco emissor (opcional)</label>
          <select id={`${idPrefix}-issuer`} name="issuer" defaultValue={defaults?.issuer ?? ""}>
            <option value="">Não informar</option>
            {CREDIT_CARD_ISSUERS.map((issuer) => <option key={issuer.key} value={issuer.key}>{issuer.name}</option>)}
          </select>
        </div>

        <div>
          <label htmlFor={`${idPrefix}-brand`}>Bandeira</label>
          <select id={`${idPrefix}-brand`} name="brand" defaultValue={defaults?.brand ?? "OTHER"}>
            {Object.entries(BRAND_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>

        <div>
          <label htmlFor={`${idPrefix}-lastDigits`}>Final do cartão (opcional)</label>
          <input id={`${idPrefix}-lastDigits`} name="lastDigits" type="text" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} placeholder="1234" defaultValue={defaults?.lastDigits ?? ""} />
        </div>

        <div className="span-2">
          <label htmlFor={`${idPrefix}-limit`}>Limite total (R$)</label>
          <input id={`${idPrefix}-limit`} name="limit" type="text" inputMode="decimal" placeholder="0,00" required defaultValue={defaults ? toInputAmount(defaults.limitCents) : undefined} />
        </div>

        <div>
          <label htmlFor={`${idPrefix}-closingDay`}>Dia do fechamento</label>
          <input id={`${idPrefix}-closingDay`} name="closingDay" type="number" min={1} max={31} required defaultValue={defaults?.closingDay} />
        </div>

        <div>
          <label htmlFor={`${idPrefix}-dueDay`}>Dia do vencimento</label>
          <input id={`${idPrefix}-dueDay`} name="dueDay" type="number" min={1} max={31} required defaultValue={defaults?.dueDay} />
        </div>

        <p className="subtitle span-2" style={{ margin: 0 }}>
          A fatura fecha no dia do fechamento: compras feitas nesse dia ou depois entram na fatura seguinte.
          Em meses sem o dia (como 31 em fevereiro), vale o último dia do mês. Mudar esses dias depois só
          vale para faturas ainda não criadas.
        </p>

        {accounts.length > 0 ? (
          <div className="span-2">
            <label htmlFor={`${idPrefix}-account`}>Conta que costuma pagar a fatura (opcional)</label>
            <select id={`${idPrefix}-account`} name="defaultPaymentAccountId" defaultValue={defaults?.defaultPaymentAccountId ?? ""}>
              <option value="">Escolher na hora de pagar</option>
              {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
            </select>
          </div>
        ) : null}
      </div>
      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
