"use client";

import { useEffect, useRef, useState } from "react";

interface Suggestion {
  categoryId: string;
  categoryName: string;
  confidence: "ALTA" | "MEDIA" | "BAIXA";
  source: "RULE" | "HISTORY" | "AI";
  costCenterId?: string | null;
  partyId?: string | null;
  rulePattern?: string;
}

type Field = HTMLSelectElement | HTMLInputElement;

function fieldOf(form: HTMLFormElement | null | undefined, name: string): Field | null {
  const element = form?.elements.namedItem(name);
  return element instanceof HTMLSelectElement || element instanceof HTMLInputElement ? element : null;
}

function setField(field: Field | null, value: string) {
  if (!field) return;
  field.value = value;
  field.dispatchEvent(new Event("change", { bubbles: true }));
}

/**
 * Dica de categoria embaixo do seletor: quando a pessoa sai do campo de descrição com a categoria
 * ainda vazia, pergunta ao servidor.
 * - Regra da empresa: já preenche categoria (e centro de custo/pessoa, se a regra tiver e o campo
 *   estiver vazio) e mostra de qual regra veio, com "Desfazer". A regra é decisão da própria empresa.
 * - Histórico ou IA: só sugere; o botão "Usar" é que muda o seletor. Qualquer escolha manual apaga a dica.
 * Falha de rede é silenciosa.
 */
export function CategorySuggestion({ type }: { type: "RECEIVABLE" | "PAYABLE" }) {
  const anchor = useRef<HTMLDivElement>(null);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [applied, setApplied] = useState<{ pattern: string; categoryName: string; filled: string[] } | null>(null);
  const applying = useRef(false);

  useEffect(() => {
    const form = anchor.current?.closest("form");
    const description = fieldOf(form, "description") as HTMLInputElement | null;
    const category = fieldOf(form, "categoryId");
    if (!form || !description || !category) return;

    let controller: AbortController | null = null;

    async function onBlur() {
      controller?.abort();
      const text = description!.value.trim();
      if (category!.value || text.length < 3) {
        setSuggestion(null);
        return;
      }
      controller = new AbortController();
      try {
        const response = await fetch("/api/suggestions/category", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ description: text, type }),
          signal: controller.signal,
        });
        if (!response.ok) return;
        const data = (await response.json()) as { suggestion: Suggestion | null };
        // A pessoa pode ter escolhido a categoria enquanto a resposta vinha.
        if (category!.value || !data.suggestion) {
          setSuggestion(null);
          return;
        }
        if (data.suggestion.source === "RULE") {
          applying.current = true;
          const filled = ["categoryId"];
          setField(category, data.suggestion.categoryId);
          const costCenter = fieldOf(form, "costCenterId");
          if (data.suggestion.costCenterId && costCenter && !costCenter.value) { setField(costCenter, data.suggestion.costCenterId); filled.push("costCenterId"); }
          const party = fieldOf(form, "partyId");
          if (data.suggestion.partyId && party && !party.value) { setField(party, data.suggestion.partyId); filled.push("partyId"); }
          applying.current = false;
          setSuggestion(null);
          setApplied({ pattern: data.suggestion.rulePattern ?? "", categoryName: data.suggestion.categoryName, filled });
          return;
        }
        setApplied(null);
        setSuggestion(data.suggestion);
      } catch {
        // Sem rede ou cancelado: a dica é um auxílio, não precisa de aviso.
      }
    }
    const onChangeCategory = () => {
      if (applying.current) return;
      setSuggestion(null);
      setApplied(null);
    };

    description.addEventListener("blur", onBlur);
    category.addEventListener("change", onChangeCategory);
    return () => {
      controller?.abort();
      description.removeEventListener("blur", onBlur);
      category.removeEventListener("change", onChangeCategory);
    };
  }, [type]);

  function apply() {
    const category = fieldOf(anchor.current?.closest("form"), "categoryId");
    if (!category || !suggestion) return;
    setField(category, suggestion.categoryId);
    setSuggestion(null);
  }

  function undo() {
    const form = anchor.current?.closest("form");
    if (!applied) return;
    applying.current = true;
    for (const name of applied.filled) setField(fieldOf(form, name), "");
    applying.current = false;
    setApplied(null);
  }

  return (
    <div ref={anchor} className="category-suggestion" aria-live="polite">
      {applied ? (
        <>
          <span>
            Preenchido pela regra <strong>&ldquo;{applied.pattern}&rdquo;</strong>
            <small> · {applied.categoryName}{applied.filled.length > 1 ? " e demais campos da regra" : ""}</small>
          </span>
          <button type="button" className="secondary" onClick={undo}>Desfazer</button>
        </>
      ) : suggestion ? (
        <>
          <span>
            Sugestão: <strong>{suggestion.categoryName}</strong>
            <small>
              {suggestion.source === "HISTORY"
                ? " · já usada nesta descrição"
                : " · sugerida por IA, confira antes de usar"}
            </small>
          </span>
          <button type="button" className="secondary" onClick={apply}>Usar</button>
        </>
      ) : null}
    </div>
  );
}
