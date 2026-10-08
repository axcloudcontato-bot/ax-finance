"use client";

import { useEffect, useRef, useState } from "react";
import { cyclesForInstallments, splitInstallments } from "@ax-finance/domain/credit-card-cycle";
import { formatCents, parseAmountToCentsOrNull } from "@/lib/currency";
import { formatDateOnly } from "@/lib/dates";

export interface PurchaseImpactCard {
  closingDay: number;
  dueDay: number;
  availableLimitCents: bigint;
  pendingInvoices?: { referenceMonth: string; closingDate: string; dueDate: string; stage: string }[];
}

/** Usa a mesma regra de ciclo/centavos do servidor; faturas existentes conservam suas datas. */
export function PurchaseImpact({ card }: { card: PurchaseImpactCard }) {
  const anchor = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState({ amount: "", date: "", count: 1 });
  useEffect(() => {
    const form = anchor.current?.closest("form");
    if (!form) return;
    const read = () => {
      const value = (name: string) => (form.elements.namedItem(name) as HTMLInputElement | null)?.value ?? "";
      setInput({ amount: value("amount"), date: value("purchaseDate"), count: Number(value("installmentCount")) });
    };
    read();
    form.addEventListener("input", read);
    form.addEventListener("change", read);
    return () => { form.removeEventListener("input", read); form.removeEventListener("change", read); };
  }, []);
  const amount = parseAmountToCentsOrNull(input.amount);
  const parsed = new Date(`${input.date}T00:00:00Z`);
  const validDate = Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === input.date;
  const valid = amount !== null && amount > 0 && Number.isInteger(input.count) && input.count >= 1 && input.count <= 48 && amount >= input.count && validDate;
  const cycles = valid ? cyclesForInstallments(card, input.date, input.count).map((cycle) => {
    const stored = card.pendingInvoices?.find((invoice) => invoice.referenceMonth === cycle.referenceMonth);
    return stored ?? cycle;
  }) : [];
  const installments = valid ? splitInstallments(amount!, input.count) : [];
  const available = card.availableLimitCents - BigInt(valid ? amount! : 0);
  return <div ref={anchor} className="span-2 credit-impact" aria-live="polite" aria-atomic="true">
    <strong>Impacto desta compra</strong>
    {!valid ? <p>Informe o valor, a data e as parcelas para conferir as faturas e o limite antes de lançar.</p> : <>
      <p>{input.count === 1 ? "Compra à vista no cartão" : `${input.count} parcelas`} · total de {formatCents(BigInt(amount!))}</p>
      <dl><div><dt>Primeiro vencimento</dt><dd>{formatDateOnly(cycles[0]!.dueDate)}</dd></div><div><dt>Último vencimento</dt><dd>{formatDateOnly(cycles[cycles.length - 1]!.dueDate)}</dd></div><div><dt>Limite após a compra</dt><dd className={available < BigInt(0) ? "negative" : undefined}>{formatCents(available)}</dd></div></dl>
      <p>O valor total compromete o limite, mesmo em compras parceladas.</p>
      {available < BigInt(0) ? <p className="credit-card-warning">Esta compra ultrapassa o limite em {formatCents(-available)}. Você pode registrá-la se ela já aconteceu; isso não representa aprovação pelo banco.</p> : null}
      {input.count > 1 ? <details><summary>Conferir as {input.count} parcelas</summary><div className="table-scroll"><table className="workspace-table"><thead><tr><th>Parcela</th><th>Vencimento</th><th className="money">Valor</th></tr></thead><tbody>{cycles.map((cycle, index) => <tr key={`${cycle.referenceMonth}-${index}`}><td>{index + 1}/{input.count}</td><td>{formatDateOnly(cycle.dueDate)}</td><td className="money">{formatCents(BigInt(installments[index]!))}</td></tr>)}</tbody></table></div></details> : null}
    </>}
  </div>;
}
