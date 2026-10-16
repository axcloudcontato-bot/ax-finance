"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Depois de criar um item pelo "+ Novo" do seletor: assim que a opção nova aparece no select, ela
 * fica escolhida (com evento `change`, para quem observa o campo, ex.: sugestão de categoria).
 */
export function useSelectAfterCreate(deps: unknown) {
  const selectRef = useRef<HTMLSelectElement>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  useEffect(() => {
    const select = selectRef.current;
    if (!pendingId || !select) return;
    if (![...select.options].some((option) => option.value === pendingId)) return;
    select.value = pendingId;
    select.dispatchEvent(new Event("change", { bubbles: true }));
    setPendingId(null);
  }, [pendingId, deps]);
  return { selectRef, selectCreated: setPendingId };
}
