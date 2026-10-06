"use client";

import { useEffect, useRef, useState } from "react";

interface Suggestion {
  categoryId: string;
  categoryName: string;
  confidence: "ALTA" | "MEDIA" | "BAIXA";
  source: "HISTORY" | "AI";
}

/**
 * Dica de categoria embaixo do seletor: quando a pessoa sai do campo de descrição com a categoria
 * ainda vazia, pergunta ao servidor e mostra a sugestão com a origem. Nunca preenche sozinho: só o
 * botão "Usar" muda o seletor, e qualquer escolha manual apaga a dica. Falha de rede é silenciosa.
 */
export function CategorySuggestion({ type }: { type: "RECEIVABLE" | "PAYABLE" }) {
  const anchor = useRef<HTMLDivElement>(null);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);

  useEffect(() => {
    const form = anchor.current?.closest("form");
    const description = form?.elements.namedItem("description") as HTMLInputElement | null;
    const category = form?.elements.namedItem("categoryId") as HTMLSelectElement | null;
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
        setSuggestion(category!.value ? null : data.suggestion);
      } catch {
        // Sem rede ou cancelado: a dica é um auxílio, não precisa de aviso.
      }
    }
    const onChangeCategory = () => setSuggestion(null);

    description.addEventListener("blur", onBlur);
    category.addEventListener("change", onChangeCategory);
    return () => {
      controller?.abort();
      description.removeEventListener("blur", onBlur);
      category.removeEventListener("change", onChangeCategory);
    };
  }, [type]);

  function apply() {
    const category = anchor.current?.closest("form")?.elements.namedItem("categoryId") as HTMLSelectElement | null;
    if (!category || !suggestion) return;
    category.value = suggestion.categoryId;
    category.dispatchEvent(new Event("change", { bubbles: true }));
    setSuggestion(null);
  }

  return (
    <div ref={anchor} className="category-suggestion" aria-live="polite">
      {suggestion ? (
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
