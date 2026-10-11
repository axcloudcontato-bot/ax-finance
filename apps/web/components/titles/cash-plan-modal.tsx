import { ActionModal } from "@/components/ui/action-modal";
import { SubmitButton } from "@/components/ui/submit-button";
import { saveTitleCashPlanAction } from "@/app/(app)/titulos-actions";

type CashPlanTitle = { id: string; expectedReceiptDate: Date | null; promisedReceiptDate: Date | null; receiptProbabilityBps: number; cashPlanningNote: string | null; expectedAccountId: string | null };
export function CashPlanModal({ title, accounts, returnTo, error }: { title: CashPlanTitle; accounts: { id: string; name: string }[]; returnTo: string; error?: string }) {
  return <ActionModal triggerLabel="Planejar recebimento" title="Previsão de recebimento" size="wide" initiallyOpen={Boolean(error)}>
    {error ? <p className="error">{error}</p> : null}
    <p className="subtitle">A promessa tem prioridade sobre a data provável. O vencimento contratual e a cobrança de atraso permanecem iguais.</p>
    <form action={saveTitleCashPlanAction.bind(null, returnTo, title.id)} className="cash-plan-form">
      <div><label htmlFor={`expected-${title.id}`}>Data provável de recebimento</label><input id={`expected-${title.id}`} name="expectedReceiptDate" type="date" defaultValue={title.expectedReceiptDate?.toISOString().slice(0, 10) ?? ""} /></div>
      <div><label htmlFor={`promise-${title.id}`}>Data prometida pelo cliente</label><input id={`promise-${title.id}`} name="promisedReceiptDate" type="date" defaultValue={title.promisedReceiptDate?.toISOString().slice(0, 10) ?? ""} /></div>
      <div><label htmlFor={`probability-${title.id}`}>Probabilidade estimada de recebimento (%)</label><input id={`probability-${title.id}`} name="receiptProbability" type="number" min="0" max="100" step="0.01" required defaultValue={title.receiptProbabilityBps / 100} /><p className="muted">50% de R$ 1.000 representa R$ 500 no cenário, sem garantir essa entrada.</p></div>
      <div><label htmlFor={`account-${title.id}`}>Conta prevista</label><select id={`account-${title.id}`} name="expectedAccountId" defaultValue={title.expectedAccountId ?? ""}><option value="">Ainda não definida</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></div>
      <div className="cash-plan-full"><label htmlFor={`note-${title.id}`}>Observação da previsão</label><textarea id={`note-${title.id}`} name="cashPlanningNote" maxLength={500} defaultValue={title.cashPlanningNote ?? ""} /></div>
      <div className="cash-plan-full"><SubmitButton>Salvar previsão</SubmitButton></div>
    </form>
  </ActionModal>;
}
