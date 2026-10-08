"use client";

import { useEffect, useRef, useState } from "react";
import { formatCents, parseAmountToCentsOrNull } from "@/lib/currency";

export function PaymentImpact({ remainingCents }: { remainingCents: bigint }) {
  const anchor = useRef<HTMLDivElement>(null);
  const [values, setValues] = useState<[number, number, number] | null>(null);
  useEffect(() => {
    const form = anchor.current?.closest("form");
    if (!form) return;
    const read = () => {
      const parsed = ["amount", "interestPenalty", "fees"].map((name) => parseAmountToCentsOrNull((form.elements.namedItem(name) as HTMLInputElement | null)?.value ?? ""));
      setValues(parsed.every((value) => value !== null && value >= 0) ? parsed as [number, number, number] : null);
    };
    read(); form.addEventListener("input", read); form.addEventListener("change", read);
    return () => { form.removeEventListener("input", read); form.removeEventListener("change", read); };
  }, []);
  const principal = values ? BigInt(values[0]) : BigInt(0);
  const total = values ? values.reduce((sum, value) => sum + BigInt(value), BigInt(0)) : null;
  const after = remainingCents - principal;
  return <div ref={anchor} className="span-2 credit-impact" aria-live="polite" aria-atomic="true"><strong>Saída total da conta: {total === null ? "confira os valores" : formatCents(total)}</strong><p>Principal + juros/multa + tarifas. Juros e tarifas não reduzem o saldo da fatura.</p>{values ? <p>{after < BigInt(0) ? "O principal informado ultrapassa o saldo da fatura. Corrija o valor para registrar." : `Saldo da fatura após este pagamento: ${formatCents(after)}.`}</p> : null}{principal > BigInt(0) && after > BigInt(0) ? <p className="credit-card-warning">Pagamento parcial: o saldo continua pendente. Confira com o banco os encargos e se houve financiamento ou parcelamento da fatura; eles não são calculados automaticamente.</p> : null}</div>;
}
