"use client";

import { useEffect, useRef, useState } from "react";

const brl = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
const parseMoney = (value: string) => Number(value.replace(/^R\$\s*/, "").replace(/\./g, "").replace(",", ".")) || 0;

/** Prévia da parcela e dos juros enquanto a pessoa preenche (mesma fórmula Price/SAC do servidor). */
export function DebtPreview() {
  const anchor = useRef<HTMLDivElement>(null);
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    const form = anchor.current?.closest("form");
    if (!form) return;
    const read = (name: string) => (form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | null)?.value ?? "";
    const update = () => {
      const principal = parseMoney(read("principal"));
      const rate = (Number(read("monthlyRate").replace("%", "").replace(",", ".")) || 0) / 100;
      const count = Number.parseInt(read("installmentCount"), 10) || 0;
      const system = read("amortization") || "PRICE";
      if (principal <= 0 || count < 1) return setText(null);
      if (system === "SAC") {
        const amortization = principal / count;
        const first = amortization + principal * rate;
        const last = amortization + amortization * rate;
        const interest = rate * amortization * ((count * (count + 1)) / 2);
        return setText(`Parcelas de ${brl(first)} (1ª) caindo até ${brl(last)} (última) · juros totais ≈ ${brl(interest)}`);
      }
      const payment = rate === 0 ? principal / count : (principal * rate) / (1 - Math.pow(1 + rate, -count));
      setText(`${count} parcelas de ${brl(payment)} · total ${brl(payment * count)} · juros ${brl(payment * count - principal)}`);
    };
    update();
    form.addEventListener("input", update);
    form.addEventListener("change", update);
    return () => {
      form.removeEventListener("input", update);
      form.removeEventListener("change", update);
    };
  }, []);

  return <div ref={anchor} className="debt-preview" aria-live="polite">{text ?? "Preencha valor, juros e parcelas para ver a parcela."}</div>;
}
