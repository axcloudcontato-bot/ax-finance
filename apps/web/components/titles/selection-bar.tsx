"use client";

import { useEffect, useRef, useState } from "react";
import { SubmitButton } from "@/components/ui/submit-button";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Barra de seleção da lista de lançamentos: mostra quantos estão marcados e quanto somam (saldo em aberto),
 * e oferece as operações em lote (formulário `formId`, fora da tabela). Lê as caixas de seleção por eventos,
 * então a tabela continua sendo renderizada no servidor. A caixa do cabeçalho marca/desmarca a página toda.
 */
export function SelectionBar({ noun, formId }: { noun: string; formId: string }) {
  const anchor = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState({ count: 0, cents: 0 });

  useEffect(() => {
    const root = anchor.current?.closest<HTMLElement>("[data-selection-root]");
    if (!root) return;
    const boxes = () => [...root.querySelectorAll<HTMLInputElement>(`input[name="ids"][form="${formId}"]`)];
    const all = root.querySelector<HTMLInputElement>("[data-select-all]");

    function recompute() {
      const checked = boxes().filter((box) => box.checked);
      setSelected({ count: checked.length, cents: checked.reduce((sum, box) => sum + Number(box.dataset.remaining ?? 0), 0) });
      if (all) {
        all.checked = checked.length > 0 && checked.length === boxes().length;
        all.indeterminate = checked.length > 0 && checked.length < boxes().length;
      }
    }
    function onChange(event: Event) {
      if (event.target === all && all) for (const box of boxes()) box.checked = all.checked;
      recompute();
    }
    root.addEventListener("change", onChange);
    recompute();
    return () => root.removeEventListener("change", onChange);
  }, [formId]);

  return (
    <div ref={anchor} className={`selection-bar ${selected.count > 0 ? "is-active" : ""}`} aria-live="polite">
      <span>
        {selected.count === 0
          ? `Marque ${noun}s na lista para somar e agir em lote.`
          : <><strong>{selected.count}</strong> {selected.count === 1 ? "selecionado" : "selecionados"} · saldo em aberto <strong>{money.format(selected.cents / 100)}</strong></>}
      </span>
      <SubmitButton form={formId} className="secondary" disabled={selected.count === 0} style={{ marginTop: 0 }}>Operações em lote</SubmitButton>
    </div>
  );
}
