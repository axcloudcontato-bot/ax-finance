import { registerCollectionAction } from "@/app/(app)/titulos-actions";
import { ActionModal } from "@/components/ui/action-modal";
import { SubmitButton } from "@/components/ui/submit-button";
import { formatDateOnly } from "@/lib/dates";
import { CollectionComposer } from "./collection-composer";
import { CopyButton } from "./copy-button";
import { PixQrCode } from "./pix-qr-code";

const DAY_MS = 86_400_000;

function dueSituation(dueDate: string, today: string): { label: string; tone: "late" | "today" | "upcoming" } {
  const diff = Math.round((Date.parse(`${dueDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY_MS);
  if (diff < 0) return { label: `${-diff} ${diff === -1 ? "dia" : "dias"} de atraso`, tone: "late" };
  if (diff === 0) return { label: "Vence hoje", tone: "today" };
  return { label: diff === 1 ? "Vence amanhã" : `Vence em ${diff} dias`, tone: "upcoming" };
}

/**
 * Cobrança de um recebível: resumo do que está em aberto, a mensagem pronta (editável) para copiar,
 * mandar no WhatsApp ou abrir no e-mail, o PIX com o valor e, depois que a pessoa enviou pelo canal que
 * preferir, o registro de que a cobrança foi feita. O sistema não envia nada sozinho.
 */
export function CollectionModal({
  titleId,
  returnTo,
  triggerLabel,
  title,
  message,
  summary,
  contact,
  pixCode,
  triggerClassName = "secondary",
}: {
  titleId: string;
  returnTo: string;
  triggerLabel: string;
  title: string;
  message: { subject: string; body: string };
  summary: {
    /** Valor em aberto já formatado. */
    amount: string;
    description: string;
    /** YYYY-MM-DD. */
    dueDate: string;
    /** YYYY-MM-DD, no fuso da empresa. */
    today: string;
    collectionCount?: number;
    lastCollectionAt?: Date | string | null;
  };
  contact: { email?: string | null; phone?: string | null };
  /** "PIX copia e cola" do valor em aberto: mostra o QR Code e o botão de copiar. */
  pixCode?: string | null;
  triggerClassName?: string;
}) {
  const situation = dueSituation(summary.dueDate, summary.today);
  const lastCollection = summary.lastCollectionAt
    ? `${summary.collectionCount ?? 1}x · última em ${formatDateOnly(summary.lastCollectionAt)}`
    : "Primeira vez";

  return (
    <ActionModal triggerLabel={triggerLabel} triggerClassName={triggerClassName} title={title}>
      <div className={`collection-modal${pixCode ? " has-pix" : ""}`}>
        <div className={`collection-summary is-${situation.tone}`}>
          <div className="collection-summary-amount">
            <span>Em aberto</span>
            <strong>{summary.amount}</strong>
            <small title={summary.description}>{summary.description}</small>
          </div>
          <dl className="collection-summary-facts">
            <div><dt>Vencimento</dt><dd>{formatDateOnly(summary.dueDate)}</dd></div>
            <div><dt>Situação</dt><dd><span className="collection-status">{situation.label}</span></dd></div>
            <div><dt>Cobranças</dt><dd>{lastCollection}</dd></div>
          </dl>
        </div>

        <div className="collection-body">
          <CollectionComposer message={message} email={contact.email ?? null} phone={contact.phone ?? null} />
          {pixCode ? (
            <aside className="collection-pix" aria-label="PIX com o valor em aberto">
              <div className="collection-section-head"><h3>PIX</h3><small>Valor já preenchido</small></div>
              <div className="collection-pix-qr"><PixQrCode code={pixCode} size={176} /></div>
              <p>O cliente lê o QR Code ou cola o código no app do banco. O código também vai na mensagem.</p>
              <code className="pix-code">{pixCode}</code>
              <CopyButton text={pixCode} label="Copiar PIX copia e cola" />
            </aside>
          ) : null}
        </div>

        <form className="collection-footer" action={registerCollectionAction.bind(null, returnTo, titleId)}>
          <p>Depois de enviar, registre a cobrança para acompanhar quantas vezes este cliente foi cobrado.</p>
          <SubmitButton className="button-link workspace-primary-action">Marcar cobrança como feita</SubmitButton>
        </form>
      </div>
    </ActionModal>
  );
}
