"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { isComparisonMode, isDateOnly, isPeriodPreset, isYearMonth } from "@/lib/month";

export interface NavItemData {
  id: string;
  title: string;
  icon: React.ElementType;
  /** Ausente = item ainda não navegável (mostra o badge como "Em breve"). */
  href?: string;
  badge?: string;
  children?: NavItemData[];
}

function hasActiveDescendant(item: NavItemData, pathname: string | null): boolean {
  return !!item.children?.some((child) => child.href === pathname || hasActiveDescendant(child, pathname));
}

export function NavItem({
  item,
  level = 0,
  collapsed = false,
  onRequestExpand,
}: {
  item: NavItemData;
  level?: number;
  collapsed?: boolean;
  onRequestExpand?: () => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hasChildren = !!item.children?.length;
  // Já abre expandido se a página atual for uma das filhas — senão, entrar
  // direto em /cadastros/categorias esconderia o item ativo dentro de
  // "Cadastros" recolhido.
  const activeDescendant = hasActiveDescendant(item, pathname);
  const [isOpen, setIsOpen] = useState(() => activeDescendant);
  const isActive = !!item.href && pathname === item.href;
  const isHighlighted = isActive || activeDescendant;
  const disabled = !item.href && !hasChildren;

  useEffect(() => {
    if (activeDescendant) setIsOpen(true);
  }, [activeDescendant]);

  function toggleChildren() {
    if (collapsed) {
      onRequestExpand?.();
      setIsOpen(true);
      return;
    }
    setIsOpen((value) => !value);
  }
  const hrefWithPeriod = item.href ? (() => {
    const [targetPath, targetQuery = ""] = item.href!.split("?");
    const params = new URLSearchParams(targetQuery);
    const from = searchParams.get("de");
    const to = searchParams.get("ate");
    const month = searchParams.get("mes");
    const preset = searchParams.get("periodo");
    const comparison = searchParams.get("comparar");
    if (isPeriodPreset(preset)) {
      params.set("periodo", preset);
    } else if (isDateOnly(from) && isDateOnly(to) && from <= to) {
      params.set("de", from);
      params.set("ate", to);
    } else if (isYearMonth(month)) {
      params.set("mes", month);
    }
    if (isComparisonMode(comparison)) params.set("comparar", comparison);
    const query = params.toString();
    return query ? `${targetPath}?${query}` : targetPath;
  })() : undefined;

  const row = (
    <div
      className={`group relative flex items-center rounded-[6px] py-[7px] transition-all duration-200 select-none ${
        collapsed ? "justify-center px-0" : "justify-between px-2.5"
      } ${
        isHighlighted
          ? "bg-black/5 font-medium text-foreground"
          : disabled
            ? "text-muted-foreground"
            : "text-muted-foreground hover:bg-black/5 hover:text-foreground/90"
      } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
      style={collapsed ? undefined : { paddingLeft: `${level * 12 + 10}px` }}
      onClick={hasChildren ? toggleChildren : undefined}
      onKeyDown={hasChildren ? (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          toggleChildren();
        }
      } : undefined}
      role={hasChildren ? "button" : undefined}
      tabIndex={hasChildren ? 0 : undefined}
      aria-expanded={hasChildren ? (!collapsed && isOpen) : undefined}
      aria-label={collapsed ? item.title : undefined}
      title={collapsed ? item.title : undefined}
    >
      <div className={`flex min-w-0 items-center ${collapsed ? "justify-center" : "gap-2.5"}`}>
        <item.icon
          className={`size-4 shrink-0 transition-colors ${
            isHighlighted ? "text-foreground" : "text-muted-foreground/70 group-hover:text-foreground/70"
          }`}
          strokeWidth={1.5}
        />
        <span className={collapsed ? "sr-only" : "truncate text-[13px] tracking-wide"}>{item.title}</span>
      </div>

      {!collapsed ? <div className="flex shrink-0 items-center gap-2">
        {item.badge ? (
          <span className="flex h-5 items-center justify-center whitespace-nowrap rounded-full bg-primary/10 px-1.5 text-[10px] font-medium text-primary">
            {item.badge}
          </span>
        ) : null}
        {hasChildren ? (
          <ChevronRight
            className={`size-3.5 text-muted-foreground/50 transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}
            strokeWidth={2}
          />
        ) : null}
      </div> : null}

      {collapsed && activeDescendant ? (
        <span className="absolute right-0 h-4 w-0.5 rounded-full bg-primary" aria-hidden="true" />
      ) : null}
    </div>
  );

  return (
    <div className="flex w-full flex-col">
      {!hasChildren && hrefWithPeriod && !disabled ? (
        <Link href={hrefWithPeriod} className="block w-full" aria-label={collapsed ? item.title : undefined}>{row}</Link>
      ) : row}

      {hasChildren && !collapsed ? (
        <div
          className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
            isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
          }`}
        >
          <div className="relative mt-0.5 flex min-h-0 flex-col gap-0.5 overflow-hidden">
            <div
              className="absolute top-0 bottom-0 border-l border-black/5"
              style={{ left: `${level * 12 + 17.5}px` }}
            />
            {item.children!.map((child) => (
              <NavItem key={child.id} item={child} level={level + 1} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
