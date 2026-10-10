"use client";

import { useState } from "react";
import { SubmitButton } from "@/components/ui/submit-button";

type Option = { id: string; name: string; parentId?: string | null };
type Initial = { categoryId: string; costCenterId: string | null; amount: string };

/** "1.234,56" → 123456 centavos (mesmo formato da máscara de reais); vazio ou inválido → 0. */
function toCents(value: string): number {
  const normalized = value.trim().replace(/^R\$\s*/, "").replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

const brl = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

/**
 * Rateio do lançamento: uma linha por pedaço (categoria, centro de custo e valor), com o total
 * conferido enquanto digita. A soma precisa fechar o valor original para salvar.
 */
export function AllocationForm({ action, clearAction, categories, costCenters, initial, error, totalCents }: {
  action: (formData: FormData) => void | Promise<void>; clearAction: (formData: FormData) => void | Promise<void>;
  categories: Option[]; costCenters: Option[]; initial: Initial[]; error?: string;
  /** Valor original do lançamento, em centavos: a soma do rateio tem de fechar nele. */
  totalCents: number;
}) {
  const blank = (): Initial => ({ categoryId: categories[0]?.id ?? "", costCenterId: null, amount: "" });
  const [rows, setRows] = useState<Initial[]>(initial.length >= 2 ? initial : [blank(), blank()]);
  const update = (index: number, patch: Partial<Initial>) => setRows((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  const sum = rows.reduce((total, row) => total + toCents(row.amount), 0);
  const diff = totalCents - sum;

  function fillRemainder(index: number) {
    const others = rows.reduce((total, row, i) => (i === index ? total : total + toCents(row.amount)), 0);
    const rest = totalCents - others;
    if (rest > 0) update(index, { amount: (rest / 100).toFixed(2).replace(".", ",") });
  }

  return (
    <>
      {error ? <p className="error">{error}</p> : null}
      <form action={action} className="allocation-form">
        <div className="allocation-head" aria-hidden="true">
          <span>Categoria</span><span>Centro de custo</span><span>Valor (R$)</span><span />
        </div>
        {rows.map((row, index) => {
          const cents = toCents(row.amount);
          const share = totalCents > 0 && cents > 0 ? Math.round((cents / totalCents) * 1000) / 10 : null;
          return (
            <div className="allocation-row" key={index}>
              <div>
                <label htmlFor={`alloc-category-${index}`}>Categoria {index + 1}</label>
                <select id={`alloc-category-${index}`} name={`categoryId-${index}`} value={row.categoryId} onChange={(event) => update(index, { categoryId: event.target.value })} required>
                  {categories.map((item) => <option key={item.id} value={item.id}>{item.parentId ? `↳ ${item.name}` : item.name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor={`alloc-center-${index}`}>Centro de custo</label>
                <select id={`alloc-center-${index}`} name={`costCenterId-${index}`} value={row.costCenterId ?? ""} onChange={(event) => update(index, { costCenterId: event.target.value || null })}>
                  <option value="">Nenhum</option>
                  {costCenters.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </div>
              <div className="allocation-amount">
                <label htmlFor={`alloc-amount-${index}`}>Valor (R$)</label>
                <input id={`alloc-amount-${index}`} name={`amount-${index}`} value={row.amount} onChange={(event) => update(index, { amount: event.target.value })} inputMode="decimal" placeholder="0,00" required />
                <small>
                  {share !== null ? `${share.toLocaleString("pt-BR")}% do total` : ""}
                  {diff > 0 && !row.amount ? <button type="button" className="allocation-fill" onClick={() => fillRemainder(index)}>usar o que falta</button> : null}
                </small>
              </div>
              <button type="button" className="allocation-remove" onClick={() => setRows((current) => current.filter((_, i) => i !== index))} disabled={rows.length <= 2} aria-label={`Remover linha ${index + 1}`} title="Remover linha">×</button>
            </div>
          );
        })}
        <input type="hidden" name="rowCount" value={rows.length} />
        <div className={`allocation-total${diff === 0 ? " is-closed" : ""}`} aria-live="polite">
          <span>Soma <strong>{brl(sum)}</strong> de {brl(totalCents)}</span>
          <span>{diff === 0 ? "Fechou o valor ✓" : diff > 0 ? `Faltam ${brl(diff)}` : `Passou ${brl(-diff)}`}</span>
        </div>
        <div className="allocation-actions">
          <button type="button" className="secondary" onClick={() => setRows((current) => [...current, blank()])} disabled={rows.length >= 50}>+ Linha</button>
          <SubmitButton>Salvar rateio</SubmitButton>
          {initial.length ? <SubmitButton formAction={clearAction} className="secondary">Remover rateio</SubmitButton> : null}
        </div>
      </form>
    </>
  );
}
