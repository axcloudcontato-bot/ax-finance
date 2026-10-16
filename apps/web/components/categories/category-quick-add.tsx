"use client";

import { useId, useRef, useState, useTransition, type FormEvent } from "react";
import { Tags } from "lucide-react";
import { StackedModal } from "@/components/ui/stacked-modal";
import { quickCreateCategoryAction } from "@/app/(app)/quick-create-actions";

type Category = { id: string; name: string; parentId: string | null };

const PAYABLE_NATURES = [
  { value: "EXPENSE", label: "Despesa" },
  { value: "COST", label: "Custo" },
  { value: "INVESTMENT", label: "Investimento" },
  { value: "FINANCING", label: "Financiamento" },
];

/**
 * "+ Nova categoria" embaixo do seletor do lançamento: abre uma janela por cima do lançamento, sem
 * sair da tela nem perder o que já foi preenchido. Criada, a categoria volta por `onCreated` para
 * já ficar escolhida.
 */
export function CategoryQuickAdd({
  kind,
  parents,
  onCreated,
}: {
  kind: "RECEIVABLE" | "PAYABLE";
  /** Categorias de topo do mesmo tipo, para escolher a categoria pai. */
  parents: Category[];
  onCreated: (category: Category) => void;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const id = useId();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // A janela está fora do formulário de baixo, mas o evento do React ainda subiria até ele.
    event.stopPropagation();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    if (!name) {
      setError("Informe o nome da categoria.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await quickCreateCategoryAction(kind, {
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
      <button ref={triggerRef} type="button" className="inline-add-toggle" onClick={() => { setError(null); setOpen(true); }}>
        + Nova categoria
      </button>
      <StackedModal
        open={open}
        onClose={() => { if (!pending) setOpen(false); }}
        originRef={triggerRef}
        title={`Nova categoria — ${kind === "RECEIVABLE" ? "Receita" : "Despesa"}`}
        icon={<Tags strokeWidth={1.8} />}
      >
        <form onSubmit={submit} noValidate className="stacked-modal-form">
          {error ? <p className="error" role="alert">{error}</p> : null}
          <label htmlFor={`${id}-nome`}>Nome</label>
          <input id={`${id}-nome`} name="name" type="text" maxLength={200} required autoComplete="off" placeholder={kind === "RECEIVABLE" ? "Ex.: Vendas, Salário" : "Ex.: Água, Luz, Aluguel"} />
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
          <p className="stacked-modal-hint">A categoria fica disponível em Cadastros &gt; Categorias e já volta escolhida no lançamento.</p>
          <div className="stacked-modal-actions">
            <button type="button" className="secondary" disabled={pending} onClick={() => setOpen(false)}>Cancelar</button>
            <button type="submit" disabled={pending}>{pending ? "Criando…" : "Criar categoria"}</button>
          </div>
        </form>
      </StackedModal>
    </>
  );
}
