import Link from "next/link";

export type StepState = "done" | "current" | "waiting" | "upcoming";

export interface ConciliationStep {
  label: string;
  /** Uma linha curta com o estado real: "3 linhas pendentes", "Arquivo em revisão"... */
  hint: string;
  state: StepState;
  href?: string;
}

/**
 * As quatro etapas da conciliação (importar, revisar, vincular, concluir) com o estado calculado
 * a partir dos dados da tela: onde a pessoa está e o que falta. Não é navegação obrigatória; cada
 * etapa com link leva ao lugar onde ela se resolve.
 */
export function ConciliationSteps({ steps }: { steps: ConciliationStep[] }) {
  return (
    <ol className="concil-steps" aria-label="Etapas da conciliação">
      {steps.map((step, index) => {
        const body = (
          <>
            <span className="concil-step-mark" aria-hidden="true">
              {step.state === "done" ? (
                <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 8.5l3 3 6-7" /></svg>
              ) : index + 1}
            </span>
            <span className="concil-step-text">
              <strong>{step.label}</strong>
              <small>{step.hint}</small>
            </span>
          </>
        );
        const status = { done: "concluída", current: "etapa atual", waiting: "em andamento", upcoming: "a seguir" }[step.state];
        return (
          <li key={step.label} className="concil-step" data-state={step.state} aria-current={step.state === "current" ? "step" : undefined}>
            <span className="sr-only">Etapa {index + 1}, {status}: </span>
            {step.href ? <Link href={step.href} className="concil-step-body">{body}</Link> : <div className="concil-step-body">{body}</div>}
          </li>
        );
      })}
    </ol>
  );
}

/** Estado das etapas a partir das importações e das linhas do período na conta escolhida. */
export function conciliationSteps(input: {
  hasLines: boolean;
  pendingCount: number;
  totalCount: number;
  previewBatchId: string | null;
  processing: boolean;
  failed: boolean;
}): ConciliationStep[] {
  const { hasLines, pendingCount, totalCount, previewBatchId, processing, failed } = input;
  const reviewOpen = Boolean(previewBatchId) || processing || failed;
  const allDone = hasLines && pendingCount === 0 && !reviewOpen;
  return [
    {
      label: "Importar extrato",
      hint: hasLines || reviewOpen ? "Extrato enviado" : "Envie o CSV ou OFX do banco",
      state: hasLines || reviewOpen ? "done" : "current",
      href: hasLines || reviewOpen ? undefined : "#importar-extrato",
    },
    {
      label: "Revisar arquivo",
      hint: previewBatchId ? "Confira a amostra e confirme" : processing ? "Importação em andamento" : failed ? "Uma importação falhou" : hasLines ? "Nada aguardando revisão" : "Depois do envio",
      state: previewBatchId || failed ? "current" : processing ? "waiting" : hasLines ? "done" : "upcoming",
      href: previewBatchId ? `/conciliacao/importacoes/${previewBatchId}` : failed ? "#importar-extrato" : undefined,
    },
    {
      label: "Vincular lançamentos",
      hint: !hasLines ? "Ligue cada linha a uma baixa" : pendingCount > 0 ? `${pendingCount} ${pendingCount === 1 ? "linha pendente" : "linhas pendentes"}` : "Todas as linhas resolvidas",
      state: !hasLines ? "upcoming" : pendingCount > 0 && !previewBatchId && !failed ? "current" : pendingCount > 0 ? "upcoming" : "done",
      href: hasLines && pendingCount > 0 ? "#linhas-extrato" : undefined,
    },
    {
      label: "Concluir",
      hint: allDone ? `${totalCount} ${totalCount === 1 ? "linha conferida" : "linhas conferidas"} no período` : "Quando não sobrar pendência",
      state: allDone ? "done" : "upcoming",
    },
  ];
}
