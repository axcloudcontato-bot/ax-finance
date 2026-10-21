"use client";

import { useEffect, useRef, useState } from "react";
import { CategoryIcon } from "./category-icon";

/**
 * Prévia do ícone da categoria, escolhido pelo nome (Aluguel → casa, Luz → raio…). Lê o nome e a
 * natureza do próprio formulário e atualiza enquanto a pessoa digita; não envia nenhum campo.
 */
export function CategoryIconPreview({ initialName = "", initialNature = "EXPENSE" }: { initialName?: string; initialNature?: string }) {
  const anchor = useRef<HTMLDivElement>(null);
  const [name, setName] = useState(initialName);
  const [nature, setNature] = useState(initialNature);

  useEffect(() => {
    const form = anchor.current?.closest("form");
    if (!form) return;
    const read = () => {
      setName((form.elements.namedItem("name") as HTMLInputElement | null)?.value ?? "");
      setNature((form.elements.namedItem("nature") as HTMLSelectElement | null)?.value || "EXPENSE");
    };
    read();
    form.addEventListener("input", read);
    form.addEventListener("change", read);
    return () => { form.removeEventListener("input", read); form.removeEventListener("change", read); };
  }, []);

  return (
    <div ref={anchor} className="category-icon-preview" aria-live="polite">
      <CategoryIcon name={name} nature={nature} size={20} />
      <div>
        <strong>{name.trim() || "Nome da categoria"}</strong>
        <small>O ícone é escolhido pelo nome e muda enquanto você digita.</small>
      </div>
    </div>
  );
}
