import { registerCollectionAction } from "@/app/(app)/titulos-actions";
import { ActionModal } from "@/components/ui/action-modal";
import { SubmitButton } from "@/components/ui/submit-button";
import { CopyButton } from "./copy-button";
import { PixQrCode } from "./pix-qr-code";

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
  pixCode,
  triggerClassName = "secondary",
}: {
  titleId: string;
  returnTo: string;
  triggerLabel: string;
  title: string;
  message: { body: string };
  mailHref: string | null;
  /** "PIX copia e cola" do valor em aberto: mostra o QR Code e o botão de copiar. */
  pixCode?: string | null;
  triggerClassName?: string;
}) {
  return (
    <ActionModal triggerLabel={triggerLabel} triggerClassName={triggerClassName} title={title} size={pixCode ? "wide" : "default"}>
      <p className="subtitle">Copie a mensagem, envie pelo canal que preferir e depois marque a cobrança como feita. Ajuste o texto se precisar.</p>
      {pixCode ? (
        <div className="pix-charge">
          <PixQrCode code={pixCode} />
          <div>
            <strong>PIX com o valor em aberto</strong>
            <p className="muted">O cliente lê o QR Code ou cola o código no app do banco: valor e recebedor já aparecem preenchidos. O código também vai na mensagem.</p>
            <code className="pix-code">{pixCode}</code>
            <CopyButton text={pixCode} label="Copiar PIX copia e cola" />
          </div>
        </div>
      ) : null}
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
