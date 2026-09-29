"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Search, X } from "@/components/ui/animated-icons";
import { cn } from "@/lib/utils";

export interface ExpandableSearchBarProps {
  open: boolean;
  value: string;
  onOpenChange: (open: boolean) => void;
  onValueChange: (value: string) => void;
  onSearch?: (query: string) => void;
  placeholder?: string;
  width?: number;
  className?: string;
}

const COLLAPSED_SIZE = 40;

export function ExpandableSearchBar({
  open,
  value,
  onOpenChange,
  onValueChange,
  onSearch,
  placeholder = "Pesquisar...",
  width = 300,
  className,
}: ExpandableSearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const handle = window.setTimeout(() => inputRef.current?.focus(), 120);
    return () => window.clearTimeout(handle);
  }, [open]);

  function closeAndClear() {
    onValueChange("");
    onOpenChange(false);
  }

  return (
    <div
      className={cn("expandable-search", className)}
      style={{ width: COLLAPSED_SIZE, height: COLLAPSED_SIZE }}
      data-open={open}
    >
      <motion.form
        className={cn("expandable-search-form", open && "is-open")}
        onSubmit={(event) => {
          event.preventDefault();
          if (!open) {
            onOpenChange(true);
            return;
          }
          if (value.trim()) onSearch?.(value.trim());
        }}
        initial={false}
        animate={{ width: open ? width : COLLAPSED_SIZE }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        <button
          type="button"
          className="expandable-search-leading"
          aria-label={open ? "Focar pesquisa" : "Abrir pesquisa"}
          aria-expanded={open}
          onClick={() => {
            if (open) inputRef.current?.focus();
            else onOpenChange(true);
          }}
        >
          <Search className="size-[18px]" strokeWidth={1.8} />
        </button>

        <AnimatePresence initial={false}>
          {open ? (
            <motion.input
              ref={inputRef}
              key="search-input"
              type="search"
              value={value}
              placeholder={placeholder}
              aria-label={placeholder}
              onChange={(event) => onValueChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") closeAndClear();
              }}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.16 }}
            />
          ) : null}
        </AnimatePresence>

        {open ? (
          <button
            type="button"
            className="expandable-search-close"
            aria-label="Fechar pesquisa"
            onClick={closeAndClear}
          >
            <X className="size-4" strokeWidth={1.8} />
          </button>
        ) : null}
      </motion.form>
    </div>
  );
}
