"use client";

import { forwardRef, useCallback, useEffect, useId, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { CategoryIcon } from "./category-icon";

export type CategoryOption = { id: string; name: string; parentId: string | null; nature?: string };

const normalize = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR");

/**
 * Seletor de categoria com ícone em cada linha, categorias principais em negrito e subcategorias
 * recuadas, com busca. O <select> nativo continua no formulário (escondido) como dono do valor:
 * name, required, sugestão de categoria, "+ Nova categoria" e testes continuam lendo e escrevendo
 * nele; este componente só desenha a lista e reflete o "change" do select.
 */
export const CategorySelect = forwardRef<HTMLSelectElement, {
  id: string;
  name?: string;
  categories: CategoryOption[];
  /** Natureza usada no ícone quando a opção não informa (entrada → receita, saída → despesa). */
  fallbackNature?: string;
  defaultValue?: string;
  required?: boolean;
  placeholder?: string;
}>(function CategorySelect({ id, name = "categoryId", categories, fallbackNature = "EXPENSE", defaultValue = "", required = true, placeholder = "Selecione" }, forwardedRef) {
  const selectRef = useRef<HTMLSelectElement>(null);
  useImperativeHandle(forwardedRef, () => selectRef.current as HTMLSelectElement);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState<{ top: number; left: number; width: number; maxHeight: number; above: boolean } | null>(null);

  const byId = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const natureOf = useCallback((category: CategoryOption) => category.nature ?? (category.parentId ? byId.get(category.parentId)?.nature : undefined) ?? fallbackNature, [byId, fallbackNature]);

  // Busca: mantém a subcategoria que casa e o pai dela (para não perder o contexto da árvore).
  const visible = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return categories;
    const hits = new Set(categories.filter((category) => normalize(category.name).includes(q)).map((category) => category.id));
    for (const category of categories) if (hits.has(category.id) && category.parentId) hits.add(category.parentId);
    return categories.filter((category) => hits.has(category.id));
  }, [categories, query]);

  // O select nativo é a fonte do valor: qualquer "change" nele (sugestão, nova categoria) atualiza a vista.
  useEffect(() => {
    const select = selectRef.current;
    if (!select) return;
    const sync = () => setValue(select.value);
    sync();
    select.addEventListener("change", sync);
    select.addEventListener("input", sync);
    return () => { select.removeEventListener("change", sync); select.removeEventListener("input", sync); };
  }, []);

  const place = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom - 12;
    const above = rect.top - 12;
    const openAbove = below < 260 && above > below;
    setPosition({ top: openAbove ? rect.top - 6 : rect.bottom + 6, left: rect.left, width: rect.width, maxHeight: Math.max(180, Math.min(380, openAbove ? above : below)), above: openAbove });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    const onMove = () => place();
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => { window.removeEventListener("resize", onMove); window.removeEventListener("scroll", onMove, true); };
  }, [open, place]);

  // Esc fecha só a lista: captura no window, antes dos ouvintes da janela de lançamento.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || listRef.current?.parentElement?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const index = Math.max(0, visible.findIndex((category) => category.id === value));
    setActive(index);
    requestAnimationFrame(() => searchRef.current?.focus());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function choose(categoryId: string) {
    const select = selectRef.current;
    if (select) {
      select.value = categoryId;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
    setValue(categoryId);
    setOpen(false);
    setQuery("");
    triggerRef.current?.focus();
  }

  function onListKey(event: KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => Math.min(visible.length - 1, index + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(0, index - 1));
    } else if (event.key === "Home") {
      event.preventDefault();
      setActive(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActive(visible.length - 1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const category = visible[active];
      if (category) choose(category.id);
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  }

  const selected = value ? byId.get(value) : undefined;
  const parentOfSelected = selected?.parentId ? byId.get(selected.parentId) : undefined;

  return (
    <div className="cat-select">
      <select
        ref={selectRef}
        id={id}
        name={name}
        required={required}
        defaultValue={defaultValue}
        className="cat-select-native"
        tabIndex={-1}
        onFocus={() => triggerRef.current?.focus()}
      >
        <option value="" disabled={required}>{placeholder}</option>
        {categories.map((category) => <option key={category.id} value={category.id}>{category.parentId ? `  ↳ ${category.name}` : category.name}</option>)}
      </select>
      <button
        ref={triggerRef}
        type="button"
        className="cat-select-trigger"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={selected ? `Categoria: ${parentOfSelected ? `${parentOfSelected.name}, ` : ""}${selected.name}` : `Categoria: ${placeholder}`}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        {selected ? (
          <span className="cat-select-value">
            <CategoryIcon name={selected.name} nature={natureOf(selected)} size={16} />
            <span className="cat-select-text">
              {parentOfSelected ? <span className="cat-select-parent">{parentOfSelected.name} ›</span> : null}
              <span className={selected.parentId ? undefined : "cat-select-strong"}>{selected.name}</span>
            </span>
          </span>
        ) : <span className="cat-select-placeholder">{placeholder}</span>}
        <svg className="cat-select-chevron" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>

      {open && position
        ? createPortal(
            <div
              className="cat-select-popover"
              data-above={position.above || undefined}
              style={{ left: position.left, width: Math.max(position.width, 260), top: position.above ? undefined : position.top, bottom: position.above ? window.innerHeight - position.top : undefined, maxHeight: position.maxHeight }}
              onKeyDown={onListKey}
            >
              <div className="cat-select-search">
                <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                <input
                  ref={searchRef}
                  type="text"
                  value={query}
                  onChange={(event) => { setQuery(event.target.value); setActive(0); }}
                  placeholder="Buscar categoria"
                  aria-label="Buscar categoria"
                  aria-controls={listId}
                  aria-activedescendant={visible[active] ? `${listId}-${visible[active]!.id}` : undefined}
                  autoComplete="off"
                />
              </div>
              <ul ref={listRef} id={listId} role="listbox" aria-label="Categorias" className="cat-select-list">
                {visible.length === 0 ? <li className="cat-select-empty">Nenhuma categoria com esse nome.</li> : null}
                {visible.map((category, index) => (
                  <li
                    key={category.id}
                    id={`${listId}-${category.id}`}
                    role="option"
                    aria-selected={category.id === value}
                    data-index={index}
                    data-active={index === active || undefined}
                    className={category.parentId ? "cat-select-option is-child" : "cat-select-option is-parent"}
                    onMouseEnter={() => setActive(index)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => choose(category.id)}
                  >
                    <CategoryIcon name={category.name} nature={natureOf(category)} size={16} />
                    <span>{category.name}</span>
                    {category.id === value ? <svg className="cat-select-check" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg> : null}
                  </li>
                ))}
              </ul>
            </div>,
            triggerRef.current?.closest(".ax-model-buttons") ?? document.body,
          )
        : null}
    </div>
  );
});
