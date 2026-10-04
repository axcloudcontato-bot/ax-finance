"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { Settings } from "@/components/ui/animated-icons";

const OPTIONAL_COLUMNS = [
  { id: "category", label: "Categoria" },
  { id: "costCenter", label: "Centro de custo" },
  { id: "dueDate", label: "Vencimento" },
  { id: "amount", label: "Valor" },
  { id: "remaining", label: "Saldo aberto" },
  { id: "status", label: "Situação" },
] as const;

type OptionalColumn = (typeof OPTIONAL_COLUMNS)[number]["id"];
const COLUMN_IDS = new Set<string>(OPTIONAL_COLUMNS.map((column) => column.id));

function readHiddenColumns(storageKey: string): OptionalColumn[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
    if (!Array.isArray(saved)) return [];
    return saved.filter((item): item is OptionalColumn => typeof item === "string" && COLUMN_IDS.has(item));
  } catch {
    return [];
  }
}

export function TitleColumnPreferences({ scope, pageName, children }: {
  scope: string;
  pageName: "Entradas" | "Saídas";
  children: ReactNode;
}) {
  const storageKey = `ax-finance:title-columns:v1:${scope}:${pageName}`;
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [hiddenColumns, setHiddenColumns] = useState<OptionalColumn[]>([]);

  useEffect(() => {
    const refresh = () => setHiddenColumns(readHiddenColumns(storageKey));
    refresh();
    const onStorage = (event: StorageEvent) => {
      if (event.key === storageKey) refresh();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [storageKey]);

  function saveHiddenColumns(next: OptionalColumn[]) {
    setHiddenColumns(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // A seleção continua funcionando nesta página quando o armazenamento está indisponível.
    }
  }

  function toggleColumn(column: OptionalColumn, visible: boolean) {
    saveHiddenColumns(visible
      ? hiddenColumns.filter((item) => item !== column)
      : [...hiddenColumns, column]);
  }

  return (
    <div className="title-list-preferences" data-hidden-columns={hiddenColumns.join(" ")}>
      <div className="title-list-toolbar">
        <button
          type="button"
          className="title-columns-trigger"
          aria-label={`Configurar colunas de ${pageName}`}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((current) => !current)}
        >
          <Settings className="size-4" /> Colunas
        </button>
      </div>
      <div id={panelId} className="title-columns-panel" hidden={!open}>
        <div className="title-columns-panel-heading">
          <div><strong>Colunas visíveis</strong><p>Escolha o que aparece por padrão nesta lista.</p></div>
          <span>Salvo neste navegador</span>
        </div>
        <div className="title-columns-options">
          <label><input type="checkbox" checked disabled /><span>Descrição <small>Obrigatória</small></span></label>
          {OPTIONAL_COLUMNS.map((column) => (
            <label key={column.id}>
              <input type="checkbox" checked={!hiddenColumns.includes(column.id)} onChange={(event) => toggleColumn(column.id, event.target.checked)} />
              <span>{column.label}</span>
            </label>
          ))}
        </div>
        <button type="button" className="title-columns-reset" onClick={() => saveHiddenColumns([])} disabled={hiddenColumns.length === 0}>
          Mostrar todas as colunas
        </button>
      </div>
      <div className="title-list-table-scroll">{children}</div>
    </div>
  );
}
