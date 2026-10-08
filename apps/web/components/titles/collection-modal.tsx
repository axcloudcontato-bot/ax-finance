import { registerCollectionAction } from "@/app/(app)/titulos-actions";
import { ActionModal } from "@/components/ui/action-modal";
import { SubmitButton } from "@/components/ui/submit-button";
import { CopyButton } from "./copy-button";

/**
 * Cobrança de um recebível: mostra a mensagem pronta para copiar ou abrir no e-mail e, depois que a pessoa
 * enviou pelo canal que preferir, registra que a cobrança foi feita. O sistema não envia nada sozinho.
 */
export function CollectionModal({
  titleId,
  returnTo,
  triggerLabel,
  title,
  message,
  mailHref,
  triggerClassName = "secondary",
}: {
  titleId: string;
  returnTo: string;
  triggerLabel: string;
  title: string;
  message: { body: string };
  mailHref: string | null;
  triggerClassName?: string;
}) {
  return (
    <ActionModal triggerLabel={triggerLabel} triggerClassName={triggerClassName} title={title}>
      <p className="subtitle">Copie a mensagem, envie pelo canal que preferir e depois marque a cobrança como feita. Ajuste o texto se precisar.</p>
      <textarea readOnly rows={9} value={message.body} aria-label="Mensagem de cobrança" />
      <div className="collection-actions">
        <CopyButton text={message.body} label="Copiar mensagem" />
        {mailHref ? <a className="button-link secondary" href={mailHref}>Abrir no e-mail</a> : <small className="muted">Cliente sem e-mail cadastrado.</small>}
      </div>
      <form action={registerCollectionAction.bind(null, returnTo, titleId)}>
        <SubmitButton>Marcar cobrança como feita</SubmitButton>
      </form>
    </ActionModal>
  );
}
