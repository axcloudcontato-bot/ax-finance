"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarRange } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MonthSelector } from "@/components/month-selector";
import {
  currentYearMonth,
  isComparisonMode,
  isDateOnly,
  isPeriodPreset,
  isYearMonth,
  resolvePeriodRange,
  type ComparisonMode,
  type PeriodPreset,
} from "@/lib/month";

export const PERIOD_SESSION_KEY = "ax-finance:period-filter:v1";

type SavedPeriod =
  | { mode: "month"; month: string; comparison?: ComparisonMode }
  | { mode: "custom"; from: string; to: string; comparison?: ComparisonMode }
  | { mode: "preset"; preset: PeriodPreset; comparison?: ComparisonMode };

const PRESET_LABEL: Record<PeriodPreset, string> = {
  hoje: "Hoje",
  "ultimos-7-dias": "Últimos 7 dias",
  trimestre: "Trimestre atual",
  ano: "Ano atual",
};

const COMPARISON_LABEL: Record<ComparisonMode, string> = {
  anterior: "Período anterior",
  "ano-anterior": "Ano anterior",
};

function readSavedPeriod(): SavedPeriod | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(PERIOD_SESSION_KEY) ?? "null") as SavedPeriod | null;
    const comparison = isComparisonMode(value?.comparison) ? value.comparison : undefined;
    if (value?.mode === "month" && isYearMonth(value.month)) return { mode: "month", month: value.month, comparison };
    if (value?.mode === "custom" && isDateOnly(value.from) && isDateOnly(value.to) && value.from <= value.to) {
      return { mode: "custom", from: value.from, to: value.to, comparison };
    }
    if (value?.mode === "preset" && isPeriodPreset(value.preset)) return { mode: "preset", preset: value.preset, comparison };
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
    periodo: searchParams.get("periodo") ?? undefined,
  });
  const urlFrom = searchParams.get("de");
  const urlTo = searchParams.get("ate");
  const hasMonthInUrl = isYearMonth(searchParams.get("mes"));
  const hasCustomInUrl = isDateOnly(urlFrom) && isDateOnly(urlTo) && urlFrom <= urlTo;
  const urlPreset = searchParams.get("periodo");
  const hasPresetInUrl = isPeriodPreset(urlPreset);
  const comparison = isComparisonMode(searchParams.get("comparar")) ? searchParams.get("comparar") as ComparisonMode : undefined;
  const [open, setOpen] = useState(false);
  const [draftMonth, setDraftMonth] = useState(period.month);
  const [draftFrom, setDraftFrom] = useState(period.from);
  const [draftTo, setDraftTo] = useState(period.to);

  const hrefFor = (saved: SavedPeriod) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("mes");
    params.delete("de");
    params.delete("ate");
    params.delete("periodo");
    if (saved.mode === "month") {
      params.set("mes", saved.month);
    } else if (saved.mode === "custom") {
      params.set("de", saved.from);
      params.set("ate", saved.to);
    } else {
      params.set("periodo", saved.preset);
    }
    if (saved.comparison) params.set("comparar", saved.comparison);
    else params.delete("comparar");
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  };

  useEffect(() => {
    if (hasPresetInUrl && urlPreset) {
      sessionStorage.setItem(PERIOD_SESSION_KEY, JSON.stringify({ mode: "preset", preset: urlPreset, comparison }));
      return;
    }
    if (hasCustomInUrl && urlFrom && urlTo) {
      sessionStorage.setItem(PERIOD_SESSION_KEY, JSON.stringify({ mode: "custom", from: urlFrom, to: urlTo, comparison }));
      return;
    }
    if (hasMonthInUrl) {
      sessionStorage.setItem(PERIOD_SESSION_KEY, JSON.stringify({ mode: "month", month: period.month, comparison }));
      return;
    }
    const saved = readSavedPeriod();
    if (!saved || (saved.mode === "month" && saved.month === currentYearMonth() && !saved.comparison)) return;
    router.replace(hrefFor(saved), { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comparison, hasCustomInUrl, hasMonthInUrl, hasPresetInUrl, pathname, period.month, router, searchParams, urlFrom, urlPreset, urlTo]);

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
    sessionStorage.setItem(PERIOD_SESSION_KEY, JSON.stringify({ mode: "month", month, comparison }));
    setOpen(false);
    router.push(hrefFor({ mode: "month", month, comparison }), { scroll: false });
  };

  const selectPreset = (preset: PeriodPreset) => {
    const saved = { mode: "preset", preset, comparison } as const;
    sessionStorage.setItem(PERIOD_SESSION_KEY, JSON.stringify(saved));
    setOpen(false);
    router.push(hrefFor(saved), { scroll: false });
  };

  const applyCustomRange = () => {
    if (!isDateOnly(draftFrom) || !isDateOnly(draftTo) || draftFrom > draftTo) return;
    const saved = { mode: "custom", from: draftFrom, to: draftTo, comparison } as const;
    sessionStorage.setItem(PERIOD_SESSION_KEY, JSON.stringify(saved));
    setOpen(false);
    router.push(hrefFor(saved), { scroll: false });
  };

  const selectComparison = (next: string) => {
    const nextComparison = isComparisonMode(next) ? next : undefined;
    const saved: SavedPeriod = period.mode === "month"
      ? { mode: "month", month: period.month, comparison: nextComparison }
      : period.mode === "preset"
        ? { mode: "preset", preset: period.preset, comparison: nextComparison }
        : { mode: "custom", from: period.from, to: period.to, comparison: nextComparison };
    sessionStorage.setItem(PERIOD_SESSION_KEY, JSON.stringify(saved));
    router.push(hrefFor(saved), { scroll: false });
  };

  return (
    <div className="global-period-filter" ref={containerRef}>
      {period.mode === "month" ? (
        <MonthSelector month={period.month} buildHref={(month) => hrefFor({ mode: "month", month, comparison })} />
      ) : (
        <div className="month-selector custom-period-label">
          <span>{period.mode === "preset" ? PRESET_LABEL[period.preset] : rangeLabel(period.from, period.to)}</span>
        </div>
      )}
      {comparison ? <span className="period-comparison-chip">vs. {COMPARISON_LABEL[comparison].toLowerCase()}</span> : null}
      <button type="button" className="period-filter-trigger" aria-label="Selecionar período e comparação" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        <CalendarRange className="size-4" /> Período
      </button>

      {open ? (
        <div className="period-filter-popover">
          <label>Atalhos</label>
          <div className="period-filter-shortcuts">
            {(Object.keys(PRESET_LABEL) as PeriodPreset[]).map((preset) => (
              <button key={preset} type="button" className={period.mode === "preset" && period.preset === preset ? "active" : ""} onClick={() => selectPreset(preset)}>
                {PRESET_LABEL[preset]}
              </button>
            ))}
          </div>
          <div className="period-filter-divider">ou mês</div>
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
          <div className="period-filter-divider">comparação</div>
          <label htmlFor="global-comparison">Comparar com</label>
          <select id="global-comparison" value={comparison ?? ""} onChange={(event) => selectComparison(event.target.value)}>
            <option value="">Sem comparação</option>
            <option value="anterior">{COMPARISON_LABEL.anterior}</option>
            <option value="ano-anterior">{COMPARISON_LABEL["ano-anterior"]}</option>
          </select>
        </div>
      ) : null}
    </div>
  );
}
