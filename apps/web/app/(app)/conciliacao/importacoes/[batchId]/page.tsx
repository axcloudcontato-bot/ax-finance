import { redirect } from "next/navigation";
import {
  decodeImportSource,
  getBankImportBatch,
  previewBankStatement,
  readImportSource,
} from "@ax-finance/domain";
import { requirePrimaryCompany } from "@/lib/company";
import { formatCents } from "@/lib/currency";
import { getCurrentUser } from "@/lib/session";
import { confirmBankImportAction } from "../../actions";

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

export default async function BankImportPreviewPage({
  params,
  searchParams,
}: {
  params: { batchId: string };
  searchParams: { erro?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await requirePrimaryCompany(user.id);
  const batch = await getBankImportBatch(user.id, company.id, params.batchId);
  if (batch.status !== "PREVIEW" || !batch.storageKey) {
    redirect(`/conciliacao?conta=${batch.financialAccountId}`);
  }
  const bytes = await readImportSource(batch.storageKey);
  const preview = previewBankStatement(batch.fileName, decodeImportSource(bytes));
  const confirmAction = confirmBankImportAction.bind(null, batch.id);

  return (
    <main className="wide">
      <div className="page-header">
        <div>
          <h1>Pré-visualizar importação</h1>
          <p className="subtitle">
            {batch.fileName} · {preview.format} · conta {batch.financialAccount.name} · {preview.totalRows} linha(s)
          </p>
        </div>
        <a className="button-link" href={`/conciliacao?conta=${batch.financialAccountId}`}>Voltar</a>
      </div>

      {searchParams.erro ? <p className="error">{searchParams.erro}</p> : null}

      <form action={confirmAction} className="card">
        {preview.format === "CSV" ? (
          <>
            <h1>Mapeamento das colunas</h1>
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
            <h1>Arquivo OFX reconhecido</h1>
            <p className="subtitle">Data, descrição, valor e FITID são lidos automaticamente.</p>
          </>
        )}

        <button type="submit">Confirmar importação</button>
        {batch.fileSizeBytes >= 512 * 1024 || batch.rowCount >= 2_000 ? (
          <p className="muted">Arquivo grande: o processamento continuará em segundo plano.</p>
        ) : null}
      </form>

      <div className="card">
        <h1>Amostra do arquivo</h1>
        {preview.format === "CSV" ? (
          <div className="table-scroll">
            <table>
              <thead><tr>{preview.headers.map((header) => <th key={header}>{header}</th>)}</tr></thead>
              <tbody>
                {preview.rawRows.map((row, index) => (
                  <tr key={index}>{preview.headers.map((header) => <td key={header}>{row[header]}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <table>
            <thead><tr><th>Data</th><th>Descrição</th><th>Valor</th></tr></thead>
            <tbody>
              {preview.normalizedRows.map((row, index) => (
                <tr key={index}>
                  <td>{row.lineDate.split("-").reverse().join("/")}</td>
                  <td>{row.description}</td>
                  <td>{formatCents(row.amountCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="muted">
          Exibindo até 10 linhas · {preview.validCount} válida(s) · {preview.invalidCount} inválida(s) com o mapeamento sugerido.
        </p>
        {preview.invalidRows.length > 0 ? (
          <details>
            <summary>Ver primeiras inconsistências</summary>
            <ul>{preview.invalidRows.map((row) => <li key={row.rowNumber}>Linha {row.rowNumber}: {row.reason}</li>)}</ul>
          </details>
        ) : null}
      </div>
    </main>
  );
}
