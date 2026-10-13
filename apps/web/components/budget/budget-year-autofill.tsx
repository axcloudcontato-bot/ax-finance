"use client";

import { useEffect, useRef, useState } from "react";

const CELL = "input.budget-year-input";

/**
 * Na grade do ano, o primeiro valor digitado numa categoria se repete nos meses que estavam vazios
 * (o orçamento costuma ser o mesmo todo mês). Enquanto a pessoa ajusta esse primeiro campo, os meses
 * repetidos acompanham; um mês alterado à mão passa a ter valor próprio. Valores já salvos não mudam.
 */
export function BudgetYearAutofill() {
  const ref = useRef<HTMLSpanElement>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;

    function onInput(event: Event) {
      const input = event.target;
      if (!(input instanceof HTMLInputElement) || !input.matches(CELL)) return;
      const row = input.closest("tr");
      if (!row) return;
      const cells = [...row.querySelectorAll<HTMLInputElement>(CELL)];
      const source = row.dataset.autofillSource;

      if (source && source !== input.name) {
        // Mês ajustado à mão: deixa de acompanhar o primeiro valor.
        delete input.dataset.autofill;
        input.dataset.touched = "1";
        return;
      }

      if (!source) {
        const targets = cells.filter((cell) => cell !== input && cell.defaultValue === "" && cell.dataset.touched !== "1");
        input.dataset.touched = "1";
        if (targets.length === 0) return;
        row.dataset.autofillSource = input.name;
        for (const cell of targets) cell.dataset.autofill = "1";
      }

      const repeated = cells.filter((cell) => cell.dataset.autofill === "1");
      for (const cell of repeated) cell.value = input.value;
      const category = row.querySelector("th")?.textContent?.replace("↳", "").trim() ?? "categoria";
      setStatus(input.value.trim() === "" ? `${category}: meses repetidos limpos.` : `${category}: valor repetido em ${repeated.length} ${repeated.length === 1 ? "mês vazio" : "meses vazios"}.`);
    }

    form.addEventListener("input", onInput);
    return () => form.removeEventListener("input", onInput);
  }, []);

  return <span ref={ref} className="sr-only" aria-live="polite">{status}</span>;
}
