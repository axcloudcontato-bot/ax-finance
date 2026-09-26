"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { MonthSelector } from "@/components/month-selector";
import { currentYearMonth } from "@/lib/month";

/**
 * Fica na casca do app (AppShell), então não recebe searchParams como uma
 * page recebe — lê a URL atual pelos hooks do App Router e troca só o "mes",
 * preservando qualquer outro parâmetro que a página esteja usando (filtro,
 * empresa, tipo, de/ate etc.).
 */
export function GlobalMonthSelector() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const month = searchParams.get("mes") ?? currentYearMonth();

  const buildHref = (target: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("mes", target);
    return `${pathname}?${params.toString()}`;
  };

  return <MonthSelector month={month} buildHref={buildHref} />;
}
