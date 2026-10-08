import Link from "next/link";
import type { listFinancialAccounts, listTitlesPage } from "@ax-finance/domain";
import { formatCents } from "@/lib/currency";
import { formatDateOnly, toDateOnlyString } from "@/lib/dates";
import { buildCollectionMessage, mailtoHref } from "@/lib/collection-message";
import { sortHref } from "@/lib/title-list-params";
import { quickSettleTitleAction } from "@/app/(app)/titulos-actions";
import { ActionModal } from "@/components/ui/action-modal";
import { SubmitButton } from "@/components/ui/submit-button";
import { TitleStatusBadge } from "./title-status-badge";
import { TitleColumnPreferences } from "./title-column-preferences";
import { SettlementForm } from "./settlement-form";
import { SelectionBar } from "./selection-bar";
import { CollectionModal } from "./collection-modal";

type TitleRow = Awaited<ReturnType<typeof listTitlesPage>>["titles"][number];
type AccountOption = Awaited<ReturnType<typeof listFinancialAccounts>>[number];

const DAY_MS = 86_400_000;
const BATCH_FORM_ID = "titles-batch-form";

const money = (cents: bigint) => (Number(cents) / 100).toFixed(2).replace(".", ",");

function SortHeader({ label, column, basePath, params }: { label: string; column: "vencimento" | "valor" | "descricao" | "pessoa"; basePath: string; params: Record<string, string | undefined> }) {
  const active = params.ordem === column;
  const arrow = active ? (params.dir === "desc" ? " ↓" : " ↑") : "";
  return <Link href={sortHref(basePath, params, column)} className="sort-link" aria-label={`Ordenar por ${label.toLowerCase()}`}>{label}{arrow}</Link>;
}

export function TitleListTable({
  titles,
  basePath,
  userId,
  companyId,
  params,
  accounts,
  today,
  lateFee,
  companyName,
}: {
  titles: TitleRow[];
  basePath: "/entradas" | "/saidas";
  userId: string;
  companyId: string;
  /** Parâmetros da URL atuais: base da ordenação e do retorno das ações da linha. */
  params: Record<string, string | undefined>;
  accounts: AccountOption[];
  today: string;
  lateFee: { lateFeeBps: number; lateInterestMonthlyBps: number };
  companyName: string;
}) {
  const receivable = basePath === "/entradas";
  const noun = receivable ? "entrada" : "saída";
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value && !["erro", "erroBaixa", "baixado", "cobrado", "agendado", "multaSalva", "titulo"].includes(key)) query.set(key, value);
  const returnTo = query.toString() ? `${basePath}?${query.toString()}` : basePath;

  return (
    <TitleColumnPreferences scope={`${userId}:${companyId}`} pageName={receivable ? "Entradas" : "Saídas"}>
      {titles.length === 0 ? <p className="muted">Nenhum lançamento encontrado.</p> : (
        <div data-selection-root>
          {/* Formulário do lote vazio e fora da tabela: as janelas de Pagar/Cobrar dentro das linhas têm
              os próprios formulários e formulário não pode conter formulário. As caixas apontam para ele. */}
          <form id={BATCH_FORM_ID} action={`${basePath}/lote`} method="get" />
          <div className="table-scroll">
          <table className="title-list-table">
            <thead>
              <tr>
                <th><input type="checkbox" data-select-all aria-label={`Selecionar todas as ${noun}s da página`} /></th>
                <th><SortHeader label="Descrição" column="descricao" basePath={basePath} params={params} /></th>
                <th data-column="party"><SortHeader label={receivable ? "Cliente" : "Fornecedor"} column="pessoa" basePath={basePath} params={params} /></th>
                <th data-column="category">Categoria</th>
                <th data-column="costCenter">Centro de custo</th>
                <th data-column="dueDate"><SortHeader label="Vencimento" column="vencimento" basePath={basePath} params={params} /></th>
                <th data-column="amount"><SortHeader label="Valor" column="valor" basePath={basePath} params={params} /></th>
                <th data-column="remaining">Saldo aberto</th>
                <th data-column="status">Situação</th>
                <th><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {titles.map((title) => {
                const open = (title.status === "OPEN" || title.status === "PARTIALLY_SETTLED") && title.remainingCents > BigInt(0);
                const isInvoice = Boolean(title.creditCardInvoice);
                const due = toDateOnlyString(title.dueDate);
                const daysLate = Math.max(0, Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${due}T00:00:00Z`)) / DAY_MS));
                                const scheduled = !receivable && open && title.scheduledPaymentDate ? formatDateOnly(title.scheduledPaymentDate) : null;
                const message = receivable && open && daysLate >= 0
                  ? buildCollectionMessage({ companyName, partyName: title.party?.name, description: title.description, remainingCents: title.remainingCents, currency: title.currency, dueDate: title.dueDate, daysLate, paymentCode: title.paymentCode })
                  : null;
                const mail = message ? mailtoHref(title.party?.email, message) : null;
                const lastCollection = title.lastCollectionAt
                  ? `Cobrado ${title.collectionCount}x · última em ${formatDateOnly(title.lastCollectionAt)}`
                  : null;

                return (
                  <tr key={title.id}>
                    <td><input type="checkbox" name="ids" form={BATCH_FORM_ID} value={title.id} data-remaining={String(title.remainingCents)} aria-label={`Selecionar ${title.description}`} /></td>
                    <td>
                      <Link href={`${basePath}/${title.id}`}>{title.description}</Link>
                      {title.documentNumber || scheduled || lastCollection ? (
                        <small className="title-row-meta">
                          {title.documentNumber ? <span>Doc. {title.documentNumber}</span> : null}
                          {scheduled ? <span className="is-scheduled">Agendado para {scheduled}</span> : null}
                          {lastCollection ? <span className="is-collected">{lastCollection}</span> : null}
                        </small>
                      ) : null}
                    </td>
                    <td data-column="party">{title.party?.name ?? "—"}</td>
                    <td data-column="category">{title.category.name}</td>
                    <td data-column="costCenter">{title.costCenter?.name ?? "—"}</td>
                    <td data-column="dueDate">{formatDateOnly(title.dueDate)}</td>
                    <td data-column="amount">{formatCents(title.originalAmountCents, title.currency)}</td>
                    <td data-column="remaining">{formatCents(title.remainingCents, title.currency)}</td>
                    <td data-column="status"><TitleStatusBadge status={title.status} dueDate={title.dueDate} /></td>
                    <td className="title-row-actions">
                      <div className="title-row-actions-inner">
                      {open && !isInvoice ? (
                        <>
                          <ActionModal triggerLabel={receivable ? "Receber" : "Pagar"} triggerClassName="secondary" title={`${receivable ? "Receber" : "Pagar"} — ${title.description}`} initiallyOpen={params.titulo === title.id && Boolean(params.erroBaixa)}>
                            <p className="subtitle">Saldo em aberto {formatCents(title.remainingCents, title.currency)}{title.party ? ` · ${title.party.name}` : ""}. Altere o valor para uma baixa parcial.</p>
                            <SettlementForm
                              action={quickSettleTitleAction.bind(null, returnTo, title.id)}
                              accounts={accounts}
                              error={params.titulo === title.id ? params.erroBaixa : undefined}
                              submitLabel={receivable ? "Confirmar recebimento" : "Confirmar pagamento"}
                              defaults={{
                                financialAccountId: title.expectedAccountId,
                                principal: money(title.remainingCents),
                                paymentMethod: title.expectedPaymentMethod,
                                lateCharge: receivable ? { dueDate: due, ...lateFee } : undefined,
                              }}
                            />
                          </ActionModal>
                          {message ? (
                            <CollectionModal
                              titleId={title.id}
                              returnTo={returnTo}
                              triggerLabel={daysLate > 0 ? "Cobrar" : "Lembrar"}
                              title={`${daysLate > 0 ? "Cobrar" : "Lembrar"} — ${title.party?.name ?? title.description}`}
                              message={message}
                              mailHref={mail}
                            />
                          ) : null}
                        </>
                      ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          <SelectionBar noun={noun} formId={BATCH_FORM_ID} />
        </div>
      )}
    </TitleColumnPreferences>
  );
}
