import { Download, Paperclip, Trash2 } from "@/components/ui/animated-icons";
import type { listTitleAttachments } from "@ax-finance/domain";
import { deleteTitleAttachmentAction, uploadTitleAttachmentAction } from "@/app/(app)/attachments/actions";
import { SubmitButton } from "@/components/ui/submit-button";

type Attachments = Awaited<ReturnType<typeof listTitleAttachments>>;

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function TitleAttachments({
  titleId,
  basePath,
  attachments,
  error,
  added,
  removed,
}: {
  titleId: string;
  basePath: "entradas" | "saidas";
  attachments: Attachments;
  error?: string;
  added?: boolean;
  removed?: boolean;
}) {
  const uploadAction = uploadTitleAttachmentAction.bind(null, basePath, titleId);
  return (
    <div className="card">
      <div className="page-header" style={{ marginBottom: "0.75rem" }}>
        <div>
          <h1>Anexos</h1>
          <p className="subtitle">PDF ou imagem, até 10 MB. Os arquivos são privados.</p>
        </div>
      </div>
      {error ? <p className="error">{error}</p> : null}
      {added ? <p className="success-box">Anexo enviado.</p> : null}
      {removed ? <p className="success-box">Anexo removido.</p> : null}

      <form action={uploadAction} className="attachment-upload-form">
        <input name="file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" required />
        <SubmitButton><Paperclip className="size-4" /> Anexar arquivo</SubmitButton>
      </form>

      {attachments.length === 0 ? (
        <p className="muted" style={{ marginTop: "1rem" }}>Nenhum arquivo anexado.</p>
      ) : (
        <div className="attachment-list">
          {attachments.map((attachment) => {
            const deleteAction = deleteTitleAttachmentAction.bind(null, basePath, titleId, attachment.id);
            return (
              <div className="attachment-item" key={attachment.id}>
                <Paperclip className="size-4" />
                <span className="attachment-info">
                  <strong>{attachment.originalName}</strong>
                  <small>{formatBytes(attachment.sizeBytes)} · {attachment.uploadedBy.name} · {attachment.createdAt.toLocaleString("pt-BR")} · {attachment.scanStatus === "CLEAN" ? "Verificado pelo antivírus" : "Não verificado"} · {attachment.storageBackend}</small>
                </span>
                <a href={`/api/attachments/${attachment.id}`} className="button-link" download>
                  <Download className="size-4" /> Baixar
                </a>
                <form action={deleteAction} className="inline">
                  <SubmitButton className="secondary" aria-label={`Remover ${attachment.originalName}`}>
                    <Trash2 className="size-4" />
                  </SubmitButton>
                </form>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
