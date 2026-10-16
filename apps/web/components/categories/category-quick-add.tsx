"use client";

import { useEffect, useId, useRef, useState, useTransition, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { Tags } from "lucide-react";
import { ModalHeader } from "@/components/ui/modal-header";
import { useModalPresence } from "@/components/ui/use-modal-presence";
import { quickCreateCategoryAction, type QuickCategoryResult } from "@/app/(app)/quick-create-actions";

type Category = { id: string; name: string; parentId: string | null };

const PAYABLE_NATURES = [
  { value: "EXPENSE", label: "Despesa" },
  { value: "COST", label: "Custo" },
  { value: "INVESTMENT", label: "Investimento" },
  { value: "FINANCING", label: "Financiamento" },
];

const FOCUSABLE = "a[href], button:not(:disabled), input:not(:disabled):not([type='hidden']), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])";

/**
 * "+ Nova categoria" embaixo do seletor do lançamento: abre uma janela própria por cima do
 * lançamento (fundo escurecido), sem sair da tela nem perder o que já foi preenchido. A janela vai
 * para o container do app (fora do formulário do lançamento); Esc e Tab ficam presos nela e não chegam à
 * janela de baixo. Criada, a categoria volta por `onCreated` para já ficar escolhida.
 */
export function CategoryQuickAdd({
  kind,
  parents,
  initiallyOpen = false,
  onCreated,
}: {
  kind: "RECEIVABLE" | "PAYABLE";
  /** Categorias de topo do mesmo tipo, para escolher a categoria pai. */
  parents: Category[];
  initiallyOpen?: boolean;
  onCreated: (category: Category) => void;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const mounted = useModalPresence(open, triggerRef, dialogRef, overlayRef);
  const label = kind === "RECEIVABLE" ? "Receita" : "Despesa";

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    const trigger = triggerRef.current;
    dialog?.querySelector<HTMLElement>("input")?.focus();
    // Captura no window: roda antes dos ouvintes da janela de lançamento e não deixa Esc fechá-la.
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" && event.key !== "Tab") return;
      event.stopPropagation();
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (!dialog) return;
      const focusable = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((element) => element.getClientRects().length > 0);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (!dialog.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      if (trigger?.isConnected) trigger.focus();
    };
  }, [open]);

  function openModal() {
    setError(null);
    setOpen(true);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // A janela está no body, mas o evento do React ainda subiria até o formulário do lançamento.
    event.stopPropagation();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    if (!name) {
      setError("Informe o nome da categoria.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result: QuickCategoryResult = await quickCreateCategoryAction(kind, {
        name,
        parentId: String(data.get("parentId") ?? "") || undefined,
        nature: String(data.get("nature") ?? "") || undefined,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onCreated(result.category);
      setOpen(false);
    });
  }

  return (
    <>
      <button ref={triggerRef} type="button" className="category-quick-add-toggle" onClick={openModal}>
        + Nova categoria
      </button>

      {mounted
        ? createPortal(
            <div
              ref={overlayRef}
              className="modal-overlay modal-overlay-stacked"
              onClick={(event) => { event.stopPropagation(); if (!pending) setOpen(false); }}
            >
              <div
                ref={dialogRef}
                className="modal-dialog category-quick-add-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby={`${id}-titulo`}
                tabIndex={-1}
                onClick={(event) => event.stopPropagation()}
              >
                <ModalHeader title={`Nova categoria — ${label}`} titleId={`${id}-titulo`} icon={<Tags strokeWidth={1.8} />} onClose={() => setOpen(false)} />
                <form onSubmit={submit} noValidate>
                  {error ? <p className="error" role="alert">{error}</p> : null}
                  <label htmlFor={`${id}-nome`}>Nome</label>
                  <input
                    id={`${id}-nome`}
                    name="name"
                    type="text"
                    maxLength={200}
                    required
                    autoComplete="off"
                    placeholder={kind === "RECEIVABLE" ? "Ex.: Vendas, Salário" : "Ex.: Água, Luz, Aluguel"}
                  />
                  <div className="form-grid">
                    <div>
                      <label htmlFor={`${id}-pai`}>Dentro de (opcional)</label>
                      <select id={`${id}-pai`} name="parentId" defaultValue="">
                        <option value="">Nenhuma — categoria principal</option>
                        {parents.map((parent) => <option key={parent.id} value={parent.id}>{parent.name}</option>)}
                      </select>
                    </div>
                    {kind === "PAYABLE" ? (
                      <div>
                        <label htmlFor={`${id}-natureza`}>Tipo de saída</label>
                        <select id={`${id}-natureza`} name="nature" defaultValue="EXPENSE">
                          {PAYABLE_NATURES.map((nature) => <option key={nature.value} value={nature.value}>{nature.label}</option>)}
                        </select>
                      </div>
                    ) : null}
                  </div>
                  <p className="category-quick-add-hint">A categoria fica disponível em Cadastros &gt; Categorias e já volta escolhida no lançamento.</p>
                  <div className="category-quick-add-actions">
                    <button type="button" className="secondary" disabled={pending} onClick={() => setOpen(false)}>Cancelar</button>
                    <button type="submit" disabled={pending}>{pending ? "Criando…" : "Criar categoria"}</button>
                  </div>
                </form>
              </div>
            </div>,
            // Dentro do container do app (fora do formulário), para os botões seguirem o padrão .ax-model-buttons.
            triggerRef.current?.closest(".ax-model-buttons") ?? document.body
          )
        : null}
    </>
  );
}
