"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { useState } from "react";

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

export function NavItem({ item, level = 0 }: { item: NavItemData; level?: number }) {
  const pathname = usePathname();
  const hasChildren = !!item.children?.length;
  // Já abre expandido se a página atual for uma das filhas — senão, entrar
  // direto em /cadastros/categorias esconderia o item ativo dentro de
  // "Cadastros" recolhido.
  const [isOpen, setIsOpen] = useState(() => hasActiveDescendant(item, pathname));
  const isActive = !!item.href && pathname === item.href;
  const disabled = !item.href && !hasChildren;

  const row = (
    <div
      className={`group flex items-center justify-between rounded-[6px] px-2.5 py-[7px] transition-all duration-200 select-none ${
        isActive
          ? "bg-black/5 font-medium text-foreground"
          : disabled
            ? "text-muted-foreground"
            : "text-muted-foreground hover:bg-black/5 hover:text-foreground/90"
      } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
      style={{ paddingLeft: `${level * 12 + 10}px` }}
      onClick={hasChildren ? () => setIsOpen((value) => !value) : undefined}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <item.icon
          className={`size-4 shrink-0 transition-colors ${
            isActive ? "text-foreground" : "text-muted-foreground/70 group-hover:text-foreground/70"
          }`}
          strokeWidth={1.5}
        />
        <span className="truncate text-[13px] tracking-wide">{item.title}</span>
      </div>

      <div className="flex shrink-0 items-center gap-2">
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
      </div>
    </div>
  );

  return (
    <div className="flex w-full flex-col">
      {!hasChildren && item.href && !disabled ? <Link href={item.href}>{row}</Link> : row}

      {hasChildren ? (
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
