import { scheduleTitlePaymentAction } from "@/app/(app)/titulos-actions";
import { ActionModal } from "@/components/ui/action-modal";
import { SubmitButton } from "@/components/ui/submit-button";
import { toDateOnlyString } from "@/lib/dates";

/**
 * Marca a saída como agendada no banco para uma data (ou remove o agendamento). Não paga nada: o dinheiro
 * só sai da conta quando o pagamento é registrado. Serve para não pagar duas vezes.
 */
export function SchedulePaymentModal({ titleId, returnTo, dueDate, scheduledDate }: { titleId: string; returnTo: string; dueDate: Date; scheduledDate: Date | null }) {
  const action = scheduleTitlePaymentAction.bind(null, returnTo, titleId);
  return (
    <ActionModal triggerLabel={scheduledDate ? "Alterar agendamento" : "Agendar pagamento"} triggerClassName="secondary" title="Agendar pagamento">
      <p className="subtitle">Use quando você já programou este pagamento no banco. Ele continua em aberto até você registrar o pagamento, mas a lista mostra que está resolvido.</p>
      <form action={action}>
        <label htmlFor="scheduledPaymentDate">Agendado no banco para</label>
        <input id="scheduledPaymentDate" name="scheduledPaymentDate" type="date" defaultValue={toDateOnlyString(scheduledDate ?? dueDate)} required />
        <SubmitButton>Salvar agendamento</SubmitButton>
      </form>
      {scheduledDate ? (
        <form action={action}>
          <input type="hidden" name="scheduledPaymentDate" value="" />
          <SubmitButton className="secondary">Remover agendamento</SubmitButton>
        </form>
      ) : null}
    </ActionModal>
  );
}
