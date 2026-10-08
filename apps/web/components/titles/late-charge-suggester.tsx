"use client";

import { useEffect, useRef, useState } from "react";
import { formatCents, parseAmountToCentsOrNull } from "@/lib/currency";
import { suggestLateChargesClient } from "@/lib/late-charges";

/** Troca o valor de um campo de formulário de um jeito que o React e a máscara de reais também enxergam. */
function setFieldValue(input: HTMLInputElement, value: string) {
  if (input.value === value) return;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

/**
 * Sugere multa e juros de atraso na baixa de um recebível e recalcula quando a pessoa muda a data efetiva ou
 * o valor recebido (baixa parcial). Se ela digitar o próprio valor em "Juros/multa", a sugestão para de
 * sobrescrever. Fica dentro do formulário de baixa e só mexe no campo `interestPenaltyAmount`.
 */
export function LateChargeSuggester({ dueDate, lateFeeBps, lateInterestMonthlyBps }: { dueDate: string; lateFeeBps: number; lateInterestMonthlyBps: number }) {
  const anchor = useRef<HTMLParagraphElement>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    const form = anchor.current?.closest("form");
    if (!form) return;
    const date = form.elements.namedItem("effectiveDate") as HTMLInputElement | null;
    const principal = form.elements.namedItem("principalAmount") as HTMLInputElement | null;
    const interest = form.elements.namedItem("interestPenaltyAmount") as HTMLInputElement | null;
    if (!date || !principal || !interest) return;

    let own = false;
    let touched = false;

    function recompute() {
      if (touched) return;
      const cents = parseAmountToCentsOrNull(principal!.value) ?? 0;
      const suggestion = suggestLateChargesClient({ principalCents: BigInt(cents), dueDate, effectiveDate: date!.value, lateFeeBps, lateInterestMonthlyBps });
      own = true;
      try {
        setFieldValue(interest!, suggestion.totalCents > BigInt(0) ? (Number(suggestion.totalCents) / 100).toFixed(2).replace(".", ",") : "0,00");
      } finally {
        own = false;
      }
      setNote(
        suggestion.totalCents > BigInt(0)
          ? `Sugestão para ${suggestion.days} ${suggestion.days === 1 ? "dia" : "dias"} de atraso: multa ${formatCents(suggestion.feeCents)} + juros ${formatCents(suggestion.interestCents)}. Confira e ajuste se combinou outro valor.`
          : "",
      );
    }

    function onInput(event: Event) {
      if (event.target === interest && !own) {
        touched = true;
        setNote("");
      }
      else if (event.target === date || event.target === principal) recompute();
    }

    form.addEventListener("input", onInput);
    form.addEventListener("change", onInput);
    recompute();
    return () => {
      form.removeEventListener("input", onInput);
      form.removeEventListener("change", onInput);
    };
  }, [dueDate, lateFeeBps, lateInterestMonthlyBps]);

  return <p ref={anchor} className="field-note" aria-live="polite">{note}</p>;
}
