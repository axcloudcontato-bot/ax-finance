import Link from "next/link";
import { redirect } from "next/navigation";
import {
  listBankStatementLines,
  listFinancialAccounts,
  listImportBatches,
  listUnreconciledSettlements,
  settlementCashDelta,
} from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { requirePlanFeature } from "@/lib/plan-access";
import { formatCents } from "@/lib/currency";
import { formatDateOnly } from "@/lib/dates";
import {
  deleteBankImportAction,
  ignoreLineAction,
  importBankStatementAction,
  reconcileLineAction,
  undoReconciliationAction,
} from "./actions";
import { isComparisonMode, periodQuery as buildPeriodQuery, resolvePeriodRange } from "@/lib/month";
import { SubmitButton } from "@/components/ui/submit-button";
import { ActionModal } from "@/components/ui/action-modal";
import { ArrowRight, Trash2 } from "@/components/ui/animated-icons";

type Line = Awaited<ReturnType<typeof listBankStatementLines>>[number];
type Candidate = Awaited<ReturnType<typeof listUnreconciledSettlements>>[number];

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendente",
  RECONCILED: "Conciliada",
  IGNORED: "Ignorada",
};

const STATUS_TONE: Record<string, string> = {
  PENDING: "is-warn",
  RECONCILED: "is-ok",
  IGNORED: "is-muted",
};

const IMPORT_STATUS_LABEL: Record<string, string> = {
  PREVIEW: "Aguardando confirmação",
  QUEUED: "Na fila",
  PROCESSING: "Processando",
  COMPLETED: "Concluída",
  FAILED: "Falhou",
};

const IMPORT_STATUS_TONE: Record<string, string> = {
  PREVIEW: "is-warn",
  QUEUED: "is-warn",
  PROCESSING: "is-warn",
  COMPLETED: "is-ok",
  FAILED: "is-bad",
};

const DAY_MS = 86_400_000;

/**
 * Sugere primeiro as baixas que explicam o valor da linha: mesmo sentido
 * (crédito ↔ entrada, débito ↔ saída) e o mesmo valor que de fato movimentou o
 * caixa (principal + juros − taxas). Depois, o mesmo sentido mais próximo da data.
 * O vínculo continua sendo escolha do usuário; isto só ordena as opções.
 */
function rankCandidates(line: Line, settlements: Candidate[]) {
  const credit = line.amountCents > BigInt(0);
  return settlements
    .map((settlement) => {
      const sameDirection = (settlement.title.type === "RECEIVABLE") === credit;
      const exact = settlementCashDelta(settlement.title.type, settlement) === line.amountCents;
      const days = Math.abs(settlement.effectiveDate.getTime() - line.lineDate.getTime()) / DAY_MS;
      return { settlement, exact, sameDirection, days };
    })
    .sort(
      (a, b) =>
        Number(b.exact) - Number(a.exact) ||
        Number(b.sameDirection) - Number(a.sameDirection) ||
        a.days - b.days
    );
}

function Amount({ cents }: { cents: bigint }) {
  const credit = cents > BigInt(0);
  return <span className={`concil-amount ${credit ? "is-credit" : ""}`}>{credit ? "+ " : ""}{formatCents(cents)}</span>;
}

function Chip({ tone, children }: { tone: string; children: string }) {
  return <span className={`concil-chip ${tone}`}>{children}</span>;
}

const REMOVE_COPY: Record<string, { trigger: string; title: string; body: (file: string, imported: number) => string; confirm: string }> = {
  PREVIEW: {
    trigger: "Descartar",
    title: "Descartar importação",
    body: (file) => `O arquivo ${file} não será importado e a cópia enviada será apagada. Nenhuma linha entra na conciliação.`,
    confirm: "Descartar importação",
  },
  FAILED: {
    trigger: "Remover",
    title: "Remover importação",
    body: (file) => `A importação ${file} falhou e será retirada da lista. Você pode enviar o arquivo de novo depois.`,
    confirm: "Remover importação",
  },
  COMPLETED: {
    trigger: "Remover",
    title: "Remover importação",
    body: (file, imported) => `${imported === 1 ? "A linha trazida" : `As ${imported} linhas trazidas`} por ${file} ${imported === 1 ? "será apagada" : "serão apagadas"} da conciliação. Só é possível se nenhuma delas tiver sido conciliada ou ignorada. Baixas e saldos não mudam, e reenviar o arquivo traz as linhas de volta.`,
    confirm: "Remover importação",
  },
};

function RemoveImportModal({ batchId, fileName, status, importedCount }: { batchId: string; fileName: string; status: string; importedCount: number }) {
  const copy = REMOVE_COPY[status];
  if (!copy) return null;
  return (
    <ActionModal triggerLabel={<Trash2 size={16} />} triggerAriaLabel={copy.trigger} triggerClassName="concil-icon-btn is-danger" title={copy.title}>
      <p>{copy.body(fileName, importedCount)}</p>
      <form action={deleteBankImportAction.bind(null, batchId)}>
        <SubmitButton>{copy.confirm}</SubmitButton>
      </form>
    </ActionModal>
  );
}

export default async function ConciliacaoPage(
  props: {
    searchParams: Promise<{
      conta?: string;
      status?: string;
      linha?: string;
      erro?: string;
      importado?: string;
      duplicado?: string;
      invalido?: string;
      enfileirado?: string;
      removida?: string;
      mes?: string;
      de?: string;
      ate?: string;
      periodo?: string;
      comparar?: string;
    }>;
  }
) {
  const searchParams = await props.searchParams;
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const company = await requirePrimaryCompany(user.id);
  await requirePlanFeature(user.id, company.id, "BANK_RECONCILIATION");

  const accounts = await listFinancialAccounts(user.id, company.id);
  const activeAccountId = searchParams.conta ?? accounts[0]?.id;

  if (!activeAccountId) {
    return (
      <main className="wide concil">
        <h1>Conciliação</h1>
        <div className="card">
          <p className="muted">Cadastre uma conta antes de importar um extrato.</p>
          <Link href="/contas" className="button-link" style={{ marginTop: "1rem" }}>Ir para Contas</Link>
        </div>
      </main>
    );
  }

  const statusFilter = (["PENDING", "RECONCILED", "IGNORED"] as const).find((status) => status === searchParams.status);
  const period = resolvePeriodRange(searchParams);

  const [allLines, unreconciledSettlements, importBatches] = await Promise.all([
    listBankStatementLines(user.id, company.id, { financialAccountId: activeAccountId, ...period }),
    listUnreconciledSettlements(user.id, company.id, activeAccountId),
    listImportBatches(user.id, company.id, activeAccountId),
  ]);

  const counts = {
    ALL: allLines.length,
    PENDING: allLines.filter((line) => line.status === "PENDING").length,
    RECONCILED: allLines.filter((line) => line.status === "RECONCILED").length,
    IGNORED: allLines.filter((line) => line.status === "IGNORED").length,
  };
  const lines = statusFilter ? allLines.filter((line) => line.status === statusFilter) : allLines;
  const selected =
    lines.find((line) => line.id === searchParams.linha) ??
    lines.find((line) => line.status === "PENDING") ??
    lines[0] ??
    null;

  const periodQuery = buildPeriodQuery(period, isComparisonMode(searchParams.comparar) ? searchParams.comparar : null);
  const accountHref = (accountId: string) => `/conciliacao?conta=${accountId}&${periodQuery}`;
  const statusHref = (status?: string) =>
    `/conciliacao?conta=${activeAccountId}${status ? `&status=${status}` : ""}&${periodQuery}`;
  const lineHref = (lineId: string) =>
    `/conciliacao?conta=${activeAccountId}${statusFilter ? `&status=${statusFilter}` : ""}&linha=${lineId}&${periodQuery}`;

  const recentBatches = importBatches.slice(0, 5);
  const lastBatch = importBatches[0];
  const batchNeedsAttention = importBatches.some((batch) => ["PREVIEW", "QUEUED", "PROCESSING", "FAILED"].includes(batch.status));
  const importOpen = Boolean(
    searchParams.erro || searchParams.importado || searchParams.enfileirado || searchParams.removida || batchNeedsAttention || importBatches.length === 0
  );

  const summary =
    counts.ALL === 0
      ? "Nenhuma linha de extrato neste período."
      : counts.PENDING > 0
        ? `${counts.PENDING} ${counts.PENDING === 1 ? "linha pendente" : "linhas pendentes"} de ${counts.ALL} neste período.`
        : "Tudo conciliado neste período.";

  const tabs: Array<{ label: string; status?: string; count: number; active: boolean }> = [
    { label: "Todas", count: counts.ALL, active: !statusFilter },
    { label: "Pendentes", status: "PENDING", count: counts.PENDING, active: statusFilter === "PENDING" },
    { label: "Conciliadas", status: "RECONCILED", count: counts.RECONCILED, active: statusFilter === "RECONCILED" },
    { label: "Ignoradas", status: "IGNORED", count: counts.IGNORED, active: statusFilter === "IGNORED" },
  ];

  const ranked = selected?.status === "PENDING" ? rankCandidates(selected, unreconciledSettlements) : [];
  const selectedCredit = selected ? selected.amountCents > BigInt(0) : true;

  return (
    <main className="wide concil">
      <header className="concil-head">
        <h1>Conciliação</h1>
        <p className="concil-summary">{summary}</p>
      </header>

      <div className="filters">
        {accounts.map((account) => (
          <a key={account.id} href={accountHref(account.id)} className={account.id === activeAccountId ? "active" : ""}>
            {account.name}
          </a>
        ))}
      </div>

      <details className="concil-import" open={importOpen}>
        <summary>
          <span className="concil-import-title">Importar extrato</span>
          <span className="concil-import-meta">
            {lastBatch ? `Última importação: ${lastBatch.fileName}` : "CSV ou OFX"}
          </span>
          <span className="concil-chevron" aria-hidden />
        </summary>
        <div className="concil-import-body">
          <p className="muted">
            Envie CSV ou OFX. Antes de confirmar, você poderá revisar a amostra e mapear as colunas
            do CSV. Reimportar o mesmo extrato não duplica linhas.
          </p>

          {searchParams.erro ? <p className="error">{searchParams.erro}</p> : null}
          {searchParams.importado ? (
            <p className="success-box">
              {searchParams.importado} importada(s) · {searchParams.duplicado} duplicada(s) ·{" "}
              {searchParams.invalido} inválida(s).
            </p>
          ) : null}
          {searchParams.removida ? <p className="success-box">Importação removida.</p> : null}
          {searchParams.enfileirado ? (
            <p className="success-box">Importação adicionada à fila. Você receberá uma notificação ao terminar.</p>
          ) : null}

          <form action={importBankStatementAction} className="concil-import-form">
            <input type="hidden" name="financialAccountId" value={activeAccountId} />
            <div>
              <label htmlFor="file">Arquivo CSV ou OFX</label>
              <input id="file" name="file" type="file" accept=".csv,.ofx,text/csv,application/x-ofx" required />
            </div>
            <SubmitButton style={{ marginTop: 0 }}>Revisar arquivo</SubmitButton>
          </form>

          {recentBatches.length > 0 ? (
            <div className="concil-recent">
              <h2>Importações recentes</h2>
              <div className="table-scroll">
                <table>
                  <thead><tr><th>Arquivo</th><th>Situação</th><th>Resultado</th><th></th></tr></thead>
                  <tbody>
                    {recentBatches.map((batch) => (
                      <tr key={batch.id}>
                        <td>{batch.fileName} <span className="muted">· {batch.fileFormat}</span></td>
                        <td><Chip tone={IMPORT_STATUS_TONE[batch.status] ?? "is-muted"}>{IMPORT_STATUS_LABEL[batch.status] ?? batch.status}</Chip></td>
                        <td>{batch.status === "COMPLETED"
                          ? `${batch.importedCount} importada(s) · ${batch.duplicateCount} duplicada(s) · ${batch.invalidCount} inválida(s)`
                          : batch.status === "FAILED" ? "Revise o arquivo e tente novamente." : "—"}</td>
                        <td>
                          <div className="concil-recent-actions">
                            {batch.status === "PREVIEW"
                              ? <Link href={`/conciliacao/importacoes/${batch.id}`} className="concil-icon-btn is-primary" aria-label="Continuar importação" title="Continuar importação"><ArrowRight size={16} /></Link>
                              : null}
                            {batch.status === "QUEUED" || batch.status === "PROCESSING" ? null : (
                              <RemoveImportModal batchId={batch.id} fileName={batch.fileName} status={batch.status} importedCount={batch.importedCount} />
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      </details>

      <div className="concil-bench-wrap">
      <div className="concil-bench">
        <section className="card concil-list" aria-label="Linhas do extrato">
          <nav className="concil-tabs" aria-label="Situação das linhas">
            {tabs.map((tab) => (
              <Link key={tab.label} href={statusHref(tab.status)} className={tab.active ? "is-active" : ""} aria-current={tab.active ? "page" : undefined}>
                {tab.label}
                <span>{tab.count}</span>
              </Link>
            ))}
          </nav>

          {lines.length === 0 ? (
            <div className="concil-empty">
              <strong>
                {statusFilter ? `Nenhuma linha ${(STATUS_LABEL[statusFilter] ?? "").toLowerCase()} neste período.` : "Nenhuma linha neste período."}
              </strong>
              <p className="muted">
                {statusFilter
                  ? "Troque a situação acima ou o mês no seletor da página."
                  : "Importe um extrato acima ou escolha outro mês no seletor da página."}
              </p>
            </div>
          ) : (
            <table className="concil-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Descrição</th>
                  <th className="is-num">Valor</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.id} className={line.id === selected?.id ? "is-selected" : undefined}>
                    <td className="is-date">{formatDateOnly(line.lineDate)}</td>
                    <td>
                      <Link href={lineHref(line.id)} className="concil-row-link" aria-current={line.id === selected?.id ? "true" : undefined}>
                        {line.description}
                      </Link>
                      {line.status === "IGNORED" && line.ignoreReason ? <span className="concil-sub">{line.ignoreReason}</span> : null}
                      {line.status === "RECONCILED" && line.reconciledSettlement ? (
                        <span className="concil-sub">{line.reconciledSettlement.title.description}</span>
                      ) : null}
                    </td>
                    <td className="is-num"><Amount cents={line.amountCents} /></td>
                    <td><Chip tone={STATUS_TONE[line.status] ?? "is-muted"}>{STATUS_LABEL[line.status] ?? line.status}</Chip></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {selected ? (
        <aside className="card concil-panel" aria-label="Linha selecionada">
            <>
              <div className="concil-panel-head">
                <h2>{selected.description}</h2>
                <Chip tone={STATUS_TONE[selected.status] ?? "is-muted"}>{STATUS_LABEL[selected.status] ?? selected.status}</Chip>
              </div>
              <dl className="concil-facts">
                <div><dt>Data</dt><dd>{formatDateOnly(selected.lineDate)}</dd></div>
                <div><dt>Valor</dt><dd><Amount cents={selected.amountCents} /></dd></div>
              </dl>

              {selected.status === "PENDING" ? (
                <>
                  <section className="concil-section">
                    <h3>
                      Conciliar com uma baixa
                      <span className="concil-count">{ranked.length}</span>
                    </h3>
                    {ranked.length > 0 && !ranked[0]!.sameDirection ? (
                      <p className="concil-hint">
                        Esta linha é {selectedCredit ? "um crédito" : "um débito"}, mas as baixas sem vínculo são{" "}
                        {selectedCredit ? "saídas" : "entradas"}. Confira antes de conciliar.
                      </p>
                    ) : null}
                    {ranked.length === 0 ? (
                      <p className="muted">
                        Não há baixas sem vínculo nesta conta. Registre {selectedCredit ? "o recebimento em" : "o pagamento em"}{" "}
                        <Link href={selectedCredit ? "/entradas" : "/saidas"} className="concil-link">
                          {selectedCredit ? "Entradas" : "Saídas"}
                        </Link>{" "}
                        e volte aqui.
                      </p>
                    ) : (
                      <ul className="concil-candidates">
                        {ranked.map(({ settlement, exact }) => (
                          <li key={settlement.id}>
                            <div className="concil-cand-main">
                              <strong>{settlement.title.description}</strong>
                              <span className="concil-sub">
                                {formatDateOnly(settlement.effectiveDate)} · {settlement.title.type === "RECEIVABLE" ? "Entrada" : "Saída"}
                                {exact ? <Chip tone="is-ok">Mesmo valor</Chip> : null}
                              </span>
                            </div>
                            <span className="concil-amount">{formatCents(settlement.principalAmountCents)}</span>
                            <form action={reconcileLineAction}>
                              <input type="hidden" name="lineId" value={selected.id} />
                              <input type="hidden" name="financialAccountId" value={activeAccountId} />
                              <input type="hidden" name="settlementId" value={settlement.id} />
                              <SubmitButton className="secondary" style={{ marginTop: 0 }}>Conciliar</SubmitButton>
                            </form>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>

                  <details className="concil-ignore">
                    <summary>Ignorar esta linha</summary>
                    <form action={ignoreLineAction}>
                      <input type="hidden" name="lineId" value={selected.id} />
                      <input type="hidden" name="financialAccountId" value={activeAccountId} />
                      <label htmlFor="ignore-reason">Motivo</label>
                      <input id="ignore-reason" type="text" name="reason" placeholder="Ex.: tarifa já lançada em outra conta" required />
                      <SubmitButton className="secondary" style={{ marginTop: "0.75rem" }}>Ignorar linha</SubmitButton>
                    </form>
                  </details>
                </>
              ) : (
                <section className="concil-section">
                  {selected.status === "RECONCILED" && selected.reconciledSettlement ? (
                    <>
                      <h3>Vinculada a</h3>
                      <p className="concil-linked">
                        <Link
                          href={`/${selected.reconciledSettlement.title.type === "RECEIVABLE" ? "entradas" : "saidas"}/${selected.reconciledSettlement.title.id}`}
                          className="concil-link"
                        >
                          {selected.reconciledSettlement.title.description}
                        </Link>
                        <span className="concil-sub">Baixa de {formatDateOnly(selected.reconciledSettlement.effectiveDate)}</span>
                      </p>
                    </>
                  ) : null}
                  {selected.status === "IGNORED" ? (
                    <>
                      <h3>Motivo</h3>
                      <p className="concil-linked">{selected.ignoreReason ?? "Sem motivo informado."}</p>
                    </>
                  ) : null}
                  <form action={undoReconciliationAction}>
                    <input type="hidden" name="lineId" value={selected.id} />
                    <input type="hidden" name="financialAccountId" value={activeAccountId} />
                    <SubmitButton className="secondary" style={{ marginTop: "1rem" }}>
                      {selected.status === "IGNORED" ? "Voltar para pendente" : "Desfazer conciliação"}
                    </SubmitButton>
                  </form>
                </section>
              )}
            </>
        </aside>
        ) : null}
      </div>
      </div>
    </main>
  );
}
