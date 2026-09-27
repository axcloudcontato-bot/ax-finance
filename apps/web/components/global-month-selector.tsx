"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarRange } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MonthSelector } from "@/components/month-selector";
import { currentYearMonth, isDateOnly, isYearMonth, resolvePeriodRange } from "@/lib/month";

export const PERIOD_SESSION_KEY = "ax-finance:period-filter:v1";

type SavedPeriod =
  | { mode: "month"; month: string }
  | { mode: "custom"; from: string; to: string };

function readSavedPeriod(): SavedPeriod | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(PERIOD_SESSION_KEY) ?? "null") as SavedPeriod | null;
    if (value?.mode === "month" && isYearMonth(value.month)) return value;
    if (value?.mode === "custom" && isDateOnly(value.from) && isDateOnly(value.to) && value.from <= value.to) return value;
  } catch {
    // Valor antigo/corrompido não deve impedir o carregamento da aplicação.
  }
  return null;
}

function rangeLabel(from: string, to: string) {
  const format = (value: string) => value.split("-").reverse().join("/");
  return `${format(from)} – ${format(to)}`;
}

export function GlobalMonthSelector() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const containerRef = useRef<HTMLDivElement>(null);
  const period = resolvePeriodRange({
    mes: searchParams.get("mes") ?? undefined,
    de: searchParams.get("de") ?? undefined,
    ate: searchParams.get("ate") ?? undefined,
  });
  const urlFrom = searchParams.get("de");
  const urlTo = searchParams.get("ate");
  const hasMonthInUrl = isYearMonth(searchParams.get("mes"));
  const hasCustomInUrl = isDateOnly(urlFrom) && isDateOnly(urlTo) && urlFrom <= urlTo;
  const [open, setOpen] = useState(false);
  const [draftMonth, setDraftMonth] = useState(period.month);
  const [draftFrom, setDraftFrom] = useState(period.from);
  const [draftTo, setDraftTo] = useState(period.to);

  const hrefFor = (saved: SavedPeriod) => {
    const params = new URLSearchParams(searchParams.toString());
    if (saved.mode === "month") {
      params.set("mes", saved.month);
      params.delete("de");
      params.delete("ate");
    } else {
      params.delete("mes");
      params.set("de", saved.from);
      params.set("ate", saved.to);
    }
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  };

  useEffect(() => {
    if (hasCustomInUrl && urlFrom && urlTo) {
      sessionStorage.setItem(PERIOD_SESSION_KEY, JSON.stringify({ mode: "custom", from: urlFrom, to: urlTo }));
      return;
    }
    if (hasMonthInUrl) {
      sessionStorage.setItem(PERIOD_SESSION_KEY, JSON.stringify({ mode: "month", month: period.month }));
      return;
    }
    const saved = readSavedPeriod();
    if (!saved || (saved.mode === "month" && saved.month === currentYearMonth())) return;
    router.replace(hrefFor(saved), { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasCustomInUrl, hasMonthInUrl, pathname, period.month, router, searchParams, urlFrom, urlTo]);

  useEffect(() => {
    setDraftMonth(period.month);
    setDraftFrom(period.from);
    setDraftTo(period.to);
  }, [period.from, period.month, period.to]);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const selectMonth = (month: string) => {
    if (!isYearMonth(month)) return;
    sessionStorage.setItem(PERIOD_SESSION_KEY, JSON.stringify({ mode: "month", month }));
    setOpen(false);
    router.push(hrefFor({ mode: "month", month }), { scroll: false });
  };

  const applyCustomRange = () => {
    if (!isDateOnly(draftFrom) || !isDateOnly(draftTo) || draftFrom > draftTo) return;
    const saved = { mode: "custom", from: draftFrom, to: draftTo } as const;
    sessionStorage.setItem(PERIOD_SESSION_KEY, JSON.stringify(saved));
    setOpen(false);
    router.push(hrefFor(saved), { scroll: false });
  };

  return (
    <div className="global-period-filter" ref={containerRef}>
      {period.mode === "month" ? (
        <MonthSelector month={period.month} buildHref={(month) => hrefFor({ mode: "month", month })} />
      ) : (
        <div className="month-selector custom-period-label"><span>{rangeLabel(period.from, period.to)}</span></div>
      )}
      <button type="button" className="period-filter-trigger" aria-label="Selecionar mês ou período personalizado" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        <CalendarRange className="size-4" /> Período
      </button>

      {open ? (
        <div className="period-filter-popover">
          <label htmlFor="global-month">Mês</label>
          <div className="period-filter-row">
            <input id="global-month" type="month" value={draftMonth} onChange={(event) => setDraftMonth(event.target.value)} />
            <button type="button" onClick={() => selectMonth(draftMonth)}>Aplicar mês</button>
          </div>
          <div className="period-filter-divider">ou intervalo personalizado</div>
          <div className="period-filter-dates">
            <div><label htmlFor="global-from">De</label><input id="global-from" type="date" value={draftFrom} onChange={(event) => setDraftFrom(event.target.value)} /></div>
            <div><label htmlFor="global-to">Até</label><input id="global-to" type="date" value={draftTo} onChange={(event) => setDraftTo(event.target.value)} /></div>
          </div>
          {draftFrom > draftTo ? <p className="period-filter-error">A data inicial deve ser anterior à final.</p> : null}
          <button type="button" className="period-filter-apply" disabled={draftFrom > draftTo} onClick={applyCustomRange}>Aplicar período</button>
        </div>
      ) : null}
    </div>
  );
}
