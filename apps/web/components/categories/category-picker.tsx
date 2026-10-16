"use client";

import { useState } from "react";
import { CategoryQuickAdd } from "./category-quick-add";
import { useSelectAfterCreate } from "@/components/ui/use-select-after-create";

type Category = { id: string; name: string; parentId: string | null };

/** Encaixa a categoria nova na ordem da árvore: depois do pai e das irmãs, ou no fim. */
export function withCategory<T extends Category>(categories: T[], category: T): T[] {
  if (categories.some((item) => item.id === category.id)) return categories;
  if (!category.parentId) return [...categories, category];
  let index = categories.findIndex((item) => item.id === category.parentId);
  if (index < 0) return [...categories, category];
  while (index + 1 < categories.length && categories[index + 1]!.parentId === category.parentId) index += 1;
  return [...categories.slice(0, index + 1), category, ...categories.slice(index + 1)];
}

/** Seletor de categoria com "+ Nova categoria" (janela por cima), para formulários do servidor. */
export function CategoryPicker({
  id,
  name = "categoryId",
  kind,
  categories,
  defaultValue = "",
  required = true,
}: {
  id: string;
  name?: string;
  kind: "RECEIVABLE" | "PAYABLE";
  /** Já filtradas pelo tipo e em ordem de árvore. */
  categories: Category[];
  defaultValue?: string;
  required?: boolean;
}) {
  const [options, setOptions] = useState(categories);
  const { selectRef, selectCreated } = useSelectAfterCreate(options);
  return (
    <>
      <select ref={selectRef} id={id} name={name} required={required} defaultValue={defaultValue}>
        <option value="" disabled={required}>Selecione</option>
        {options.map((category) => (
          <option key={category.id} value={category.id}>{category.parentId ? `  ↳ ${category.name}` : category.name}</option>
        ))}
      </select>
      <CategoryQuickAdd
        kind={kind}
        parents={options.filter((category) => !category.parentId)}
        onCreated={(category) => { setOptions((current) => withCategory(current, category)); selectCreated(category.id); }}
      />
    </>
  );
}
