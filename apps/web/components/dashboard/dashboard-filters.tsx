"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Filter, X } from "@/components/ui/animated-icons";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { GlobalMonthSelector } from "@/components/global-month-selector";

const FILTER_KEYS = ["conta", "categoria", "pessoa", "centroCusto"] as const;
const SESSION_PREFIX = "ax-finance:dashboard-filters:v1:";

type FilterKey = (typeof FILTER_KEYS)[number];
type DashboardFilterValues = Partial<Record<FilterKey, string>>;

interface Option {
  id: string;
  name: string;
}

function valuesFromParams(params: URLSearchParams): DashboardFilterValues {
  return Object.fromEntries(
    FILTER_KEYS.map((key) => [key, params.get(key) || undefined]).filter((entry) => entry[1])
  );
}

export function DashboardFilters({
  companyId,
  accounts,
  categories,
  parties,
  costCenters,
  values,
  actions,
}: {
  companyId: string;
  accounts: Option[];
  categories: Option[];
  parties: Option[];
  costCenters: Option[];
  values: DashboardFilterValues;
  actions?: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const storageKey = `${SESSION_PREFIX}${companyId}`;
  const [draft, setDraft] = useState<DashboardFilterValues>(values);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const hasFiltersInUrl = FILTER_KEYS.some((key) => searchParams.has(key));

  const allowed = useMemo(() => ({
    conta: new Set(accounts.map((option) => option.id)),
    categoria: new Set(categories.map((option) => option.id)),
    pessoa: new Set(parties.map((option) => option.id)),
    centroCusto: new Set(costCenters.map((option) => option.id)),
  }), [accounts, categories, costCenters, parties]);

  useEffect(() => {
    setDraft(values);
  }, [values.conta, values.categoria, values.pessoa, values.centroCusto]);

  useEffect(() => {
    if (hasFiltersInUrl) {
      sessionStorage.setItem(storageKey, JSON.stringify(valuesFromParams(new URLSearchParams(searchParams.toString()))));
      return;
    }

    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) ?? "null") as DashboardFilterValues | null;
      if (!saved) return;
      const valid = Object.fromEntries(FILTER_KEYS.flatMap((key) => {
        const value = saved[key];
        return value && allowed[key].has(value) ? [[key, value]] : [];
      })) as DashboardFilterValues;
      if (!FILTER_KEYS.some((key) => valid[key])) return;
      const params = new URLSearchParams(searchParams.toString());
      for (const key of FILTER_KEYS) if (valid[key]) params.set(key, valid[key]!);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    } catch {
      sessionStorage.removeItem(storageKey);
    }
  }, [allowed, hasFiltersInUrl, pathname, router, searchParams, storageKey]);

  function navigate(next: DashboardFilterValues) {
    const params = new URLSearchParams(searchParams.toString());
    for (const key of FILTER_KEYS) {
      if (next[key]) params.set(key, next[key]!);
      else params.delete(key);
    }
    sessionStorage.setItem(storageKey, JSON.stringify(next));
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  const update = (key: FilterKey, value: string) => setDraft((current) => ({ ...current, [key]: value || undefined }));
  const activeCount = FILTER_KEYS.filter((key) => values[key]).length;

  return (
    <section className="dashboard-filter-card dashboard-command-center" aria-label="Filtros analíticos do dashboard">
      <div className="dashboard-command-header">
        <div className="dashboard-command-copy">
          <span className="dashboard-command-icon"><Filter className="size-[18px]" /></span>
          <span>
            <strong>Filtros analíticos</strong>
            <small>Refine a visão sem perder o contexto do período.</small>
          </span>
        </div>

        <div className="dashboard-command-period">
          <span className="dashboard-command-label">Período analisado</span>
          <GlobalMonthSelector />
        </div>

        {actions ? <div className="dashboard-command-actions" aria-label="Ações financeiras rápidas">{actions}</div> : null}
      </div>

      <button
        type="button"
        className="dashboard-filter-toggle"
        data-active-count={activeCount}
        aria-expanded={filtersOpen}
        aria-controls="dashboard-advanced-filters"
        onClick={() => setFiltersOpen((open) => !open)}
      >
        <span><Filter className="size-4" /> Filtrar dados</span>
        <span>{activeCount > 0 ? `${activeCount} ${activeCount === 1 ? "filtro ativo" : "filtros ativos"}` : "Conta, categoria, pessoa e centro de custo"}</span>
      </button>
      <div id="dashboard-advanced-filters" className="dashboard-filter-grid" hidden={!filtersOpen}>
        <label>
          Conta
          <select value={draft.conta ?? ""} onChange={(event) => update("conta", event.target.value)}>
            <option value="">Todas</option>
            {accounts.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
          </select>
        </label>
        <label>
          Categoria
          <select value={draft.categoria ?? ""} onChange={(event) => update("categoria", event.target.value)}>
            <option value="">Todas</option>
            {categories.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
          </select>
        </label>
        <label>
          Cliente/fornecedor
          <select value={draft.pessoa ?? ""} onChange={(event) => update("pessoa", event.target.value)}>
            <option value="">Todos</option>
            {parties.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
          </select>
        </label>
        <label>
          Centro de custo
          <select value={draft.centroCusto ?? ""} onChange={(event) => update("centroCusto", event.target.value)}>
            <option value="">Todos</option>
            {costCenters.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
          </select>
        </label>
        <div className="dashboard-filter-actions">
          <button type="button" onClick={() => navigate(draft)}>Aplicar</button>
          <button type="button" className="secondary" disabled={activeCount === 0} onClick={() => {
            setDraft({});
            navigate({});
          }}>
            <X className="size-4" /> Limpar
          </button>
        </div>
      </div>
    </section>
  );
}
