import { redirect } from "next/navigation";
import {
  decodeImportSource,
  getBankImportBatch,
  previewBankStatement,
  readImportSource,
} from "@ax-finance/domain";
import { requirePrimaryCompany } from "@/lib/company";
import { requirePlanFeature } from "@/lib/plan-access";
import { formatCents } from "@/lib/currency";
import { getCurrentUser } from "@/lib/session";
import { confirmBankImportAction, deleteBankImportAction } from "../../actions";
import { SubmitButton } from "@/components/ui/submit-button";
import { ActionModal } from "@/components/ui/action-modal";
import { Trash2 } from "@/components/ui/animated-icons";

function ColumnSelect({
  name,
  label,
  headers,
  defaultValue,
  required = false,
}: {
  name: string;
  label: string;
  headers: string[];
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <label>
      {label}
      <select name={name} defaultValue={defaultValue || ""} required={required}>
        <option value="">Não usar</option>
        {headers.map((header) => <option key={header} value={header}>{header}</option>)}
      </select>
    </label>
  );
}

export default async function BankImportPreviewPage(
  props: {
    params: Promise<{ batchId: string }>;
    searchParams: Promise<{ erro?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await requirePrimaryCompany(user.id);
  await requirePlanFeature(user.id, company.id, "BANK_RECONCILIATION");
  const batch = await getBankImportBatch(user.id, company.id, params.batchId);
  if (batch.status !== "PREVIEW" || !batch.storageKey) {
    redirect(`/conciliacao?conta=${batch.financialAccountId}`);
  }
  const bytes = await readImportSource(batch.storageKey);
  const preview = previewBankStatement(batch.fileName, decodeImportSource(bytes));
  const confirmAction = confirmBankImportAction.bind(null, batch.id);

  return (
    <main className="wide concil">
      <div className="page-header">
        <div>
          <h1>Pré-visualizar importação</h1>
          <p className="subtitle">
            {batch.fileName} · {preview.format} · conta {batch.financialAccount.name} · {preview.totalRows} linha(s)
          </p>
        </div>
        <div className="concil-recent-actions">
          <ActionModal triggerLabel={<Trash2 size={16} />} triggerAriaLabel="Descartar importação" triggerClassName="concil-icon-btn is-danger" title="Descartar importação">
            <p>O arquivo {batch.fileName} não será importado e a cópia enviada será apagada. Nenhuma linha entra na conciliação.</p>
            <form action={deleteBankImportAction.bind(null, batch.id)}>
              <SubmitButton>Descartar importação</SubmitButton>
            </form>
          </ActionModal>
          <a className="button-link" href={`/conciliacao?conta=${batch.financialAccountId}`}>Voltar</a>
        </div>
      </div>

      {searchParams.erro ? <p className="error">{searchParams.erro}</p> : null}

      <div className="concil-bench-wrap">
      <div className="concil-bench">

      <section className="card concil-list" aria-label="Amostra do arquivo">
        <h2 className="concil-card-title">Amostra do arquivo</h2>
        <p className="concil-sample-stats">
          <span className="concil-chip is-ok">{preview.validCount} válida(s)</span>
          <span className={`concil-chip ${preview.invalidCount > 0 ? "is-bad" : ""}`}>{preview.invalidCount} inválida(s)</span>
          <span className="muted">com o mapeamento sugerido · exibindo até 10 linhas</span>
        </p>
        {preview.format === "CSV" ? (
          <div className="table-scroll">
            <table className="concil-table">
              <thead><tr>{preview.headers.map((header) => <th key={header}>{header}</th>)}</tr></thead>
              <tbody>
                {preview.rawRows.map((row, index) => (
                  <tr key={index}>{preview.headers.map((header) => <td key={header}>{row[header]}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <table className="concil-table">
            <thead><tr><th>Data</th><th>Descrição</th><th className="is-num">Valor</th></tr></thead>
            <tbody>
              {preview.normalizedRows.map((row, index) => (
                <tr key={index}>
                  <td>{row.lineDate.split("-").reverse().join("/")}</td>
                  <td>{row.description}</td>
                  <td className="is-num concil-amount">{formatCents(row.amountCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {preview.invalidRows.length > 0 ? (
          <details className="concil-ignore">
            <summary>Ver primeiras inconsistências</summary>
            <ul>{preview.invalidRows.map((row) => <li key={row.rowNumber}>Linha {row.rowNumber}: {row.reason}</li>)}</ul>
          </details>
        ) : null}
      </section>
      <form action={confirmAction} className="card concil-panel concil-mapping">
        {preview.format === "CSV" ? (
          <>
            <h2>Mapeamento das colunas</h2>
            <p className="subtitle">
              As opções foram sugeridas pelos cabeçalhos. Confirme ou ajuste antes de importar.
            </p>
            <div className="form-grid">
              <ColumnSelect name="dateColumn" label="Data" headers={preview.headers}
                defaultValue={preview.suggestedMapping?.dateColumn} required />
              <ColumnSelect name="descriptionColumn" label="Descrição" headers={preview.headers}
                defaultValue={preview.suggestedMapping?.descriptionColumn} required />
              <ColumnSelect name="amountColumn" label="Valor com sinal" headers={preview.headers}
                defaultValue={preview.suggestedMapping?.amountColumn} />
              <ColumnSelect name="debitColumn" label="Débito/saída" headers={preview.headers}
                defaultValue={preview.suggestedMapping?.debitColumn} />
              <ColumnSelect name="creditColumn" label="Crédito/entrada" headers={preview.headers}
                defaultValue={preview.suggestedMapping?.creditColumn} />
            </div>
            <p className="muted">
              Use “Valor com sinal” quando entradas e saídas estiverem na mesma coluna. Caso contrário,
              deixe-a vazia e escolha débito e crédito separadamente.
            </p>
          </>
        ) : (
          <>
            <h2>Arquivo OFX reconhecido</h2>
            <p className="subtitle">Data, descrição, valor e FITID são lidos automaticamente.</p>
          </>
        )}

        <SubmitButton style={{ marginTop: "1.25rem" }}>Confirmar importação</SubmitButton>
        {batch.fileSizeBytes >= 512 * 1024 || batch.rowCount >= 2_000 ? (
          <p className="muted">Arquivo grande: o processamento continuará em segundo plano.</p>
        ) : null}
      </form>
      </div>
      </div>
    </main>
  );
}
