import { randomUUID } from "node:crypto";
import { SubmitButton } from "@/components/ui/submit-button";
import { formatCents } from "@/lib/currency";
import { GoalAppearancePicker } from "./goal-visuals";

type Account = { id: string; name: string };

interface GoalDefaults {
  name: string;
  targetAmountCents: bigint;
  targetDate: Date | null;
  color: string;
  icon: string;
  defaultSourceAccountId: string | null;
}

/** Valor em reais para o campo de texto ("1500,00"), no formato que o leitor de valores aceita. */
function toInputAmount(cents: bigint): string {
  return (Number(cents) / 100).toFixed(2).replace(".", ",");
}

/** Criar ou editar cofrinho. Server component: serve dentro de modais. */
export function GoalForm({
  action,
  accounts,
  defaults,
  idPrefix = "cofrinho",
  submitLabel = "Criar cofrinho",
}: {
  action: (formData: FormData) => void | Promise<void>;
  accounts: Account[];
  defaults?: GoalDefaults;
  idPrefix?: string;
  submitLabel?: string;
}) {
  const creating = !defaults;
  return (
    <form action={action}>
      {creating ? <input type="hidden" name="idempotencyKey" value={randomUUID()} /> : null}
      <div className="form-grid">
        <div className="span-2">
          <label htmlFor={`${idPrefix}-name`}>Nome do cofrinho</label>
          <input id={`${idPrefix}-name`} name="name" type="text" required maxLength={80} placeholder="Ex.: Viagem de férias, Reserva de emergência" defaultValue={defaults?.name} />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-target`}>Meta (R$)</label>
          <input id={`${idPrefix}-target`} name="targetAmount" type="text" inputMode="decimal" placeholder="0,00" required defaultValue={defaults ? toInputAmount(defaults.targetAmountCents) : undefined} />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-date`}>Quero chegar até (opcional)</label>
          <input id={`${idPrefix}-date`} name="targetDate" type="date" defaultValue={defaults?.targetDate ? defaults.targetDate.toISOString().slice(0, 10) : undefined} />
        </div>
        <div className="span-2">
          <label htmlFor={`${idPrefix}-source`}>Conta de onde costuma guardar (opcional)</label>
          <select id={`${idPrefix}-source`} name="defaultSourceAccountId" defaultValue={defaults?.defaultSourceAccountId ?? ""}>
            <option value="">Escolher a cada vez</option>
            {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
          </select>
        </div>
        <div className="span-2 goal-picker-row">
          <GoalAppearancePicker idPrefix={idPrefix} icon={defaults?.icon ?? "piggy"} color={defaults?.color ?? "blue"} />
        </div>
        {creating ? (
          <div className="span-2">
            <label htmlFor={`${idPrefix}-initial`}>Já quer guardar algum valor agora? (opcional)</label>
            <input id={`${idPrefix}-initial`} name="initialAmount" type="text" inputMode="decimal" placeholder="0,00" />
            <p className="field-note">Sai da conta escolhida acima. Sem conta escolhida, use o botão Guardar depois.</p>
          </div>
        ) : null}
      </div>
      <div className="form-actions"><SubmitButton>{submitLabel}</SubmitButton></div>
    </form>
  );
}

/** Guardar (conta → cofrinho) ou resgatar (cofrinho → conta). */
export function GoalMoveForm({
  action,
  accounts,
  direction,
  balanceCents,
  defaultAccountId,
  today,
  idPrefix,
}: {
  action: (formData: FormData) => void | Promise<void>;
  accounts: Account[];
  direction: "DEPOSIT" | "WITHDRAW";
  balanceCents: bigint;
  defaultAccountId: string | null;
  today: string;
  idPrefix: string;
}) {
  const deposit = direction === "DEPOSIT";
  const initialAccount = defaultAccountId && accounts.some((account) => account.id === defaultAccountId) ? defaultAccountId : accounts.length === 1 ? accounts[0]!.id : "";
  if (accounts.length === 0) return <p className="muted">Cadastre uma conta em Contas antes de {deposit ? "guardar" : "resgatar"}.</p>;
  return (
    <form action={action}>
      <input type="hidden" name="idempotencyKey" value={randomUUID()} />
      {!deposit ? <p className="subtitle">Disponível no cofrinho: <strong>{formatCents(balanceCents)}</strong></p> : null}
      <div className="form-grid">
        <div className="span-2">
          <label htmlFor={`${idPrefix}-account`}>{deposit ? "Tirar da conta" : "Devolver para a conta"}</label>
          <select id={`${idPrefix}-account`} name="accountId" required defaultValue={initialAccount}>
            <option value="" disabled>Selecione</option>
            {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor={`${idPrefix}-amount`}>Valor (R$)</label>
          <input id={`${idPrefix}-amount`} name="amount" type="text" inputMode="decimal" placeholder="0,00" required />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-date`}>Data</label>
          <input id={`${idPrefix}-date`} name="date" type="date" required max={today} defaultValue={today} />
        </div>
        <div className="span-2">
          <label htmlFor={`${idPrefix}-note`}>Observação (opcional)</label>
          <input id={`${idPrefix}-note`} name="note" type="text" maxLength={200} placeholder={deposit ? "Ex.: sobra do mês" : "Ex.: pagamento da passagem"} />
        </div>
      </div>
      <div className="form-actions"><SubmitButton>{deposit ? "Guardar" : "Resgatar"}</SubmitButton></div>
    </form>
  );
}
