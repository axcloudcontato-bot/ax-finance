"use client";

import { useState } from "react";
import Link from "next/link";
import { formatCents, parseAmountToCentsOrNull } from "@/lib/currency";
import { SubmitButton } from "@/components/ui/submit-button";

type AccountOption = { id: string; name: string };

export function TransferForm({
  accounts,
  action,
  today,
  idempotencyKey,
}: {
  accounts: AccountOption[];
  action: (formData: FormData) => void | Promise<void>;
  today: string;
  idempotencyKey: string;
}) {
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [amount, setAmount] = useState("");
  const [fee, setFee] = useState("0,00");
  const amountParsed = parseAmountToCentsOrNull(amount);
  const feeParsed = parseAmountToCentsOrNull(fee);
  const amountCents = amountParsed ?? 0;
  const feeCents = feeParsed ?? 0;
  const from = accounts.find((account) => account.id === fromId);
  const to = accounts.find((account) => account.id === toId);
  const ready = Boolean(from && to && fromId !== toId && amountCents > 0 && feeParsed !== null && feeCents >= 0);

  return (
    <form action={action}>
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <div className="form-grid">
        <div>
          <label htmlFor="fromAccountId">Conta de origem</label>
          <select id="fromAccountId" name="fromAccountId" value={fromId} onChange={(event) => setFromId(event.target.value)} required>
            <option value="" disabled>Selecione a conta que será debitada</option>
            {accounts.map((account) => <option key={account.id} value={account.id} disabled={account.id === toId}>{account.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="toAccountId">Conta de destino</label>
          <select id="toAccountId" name="toAccountId" value={toId} onChange={(event) => setToId(event.target.value)} required>
            <option value="" disabled>Selecione a conta que receberá</option>
            {accounts.map((account) => <option key={account.id} value={account.id} disabled={account.id === fromId}>{account.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="amount">Valor transferido (R$)</label>
          <input id="amount" name="amount" type="text" inputMode="decimal" placeholder="0,00" value={amount} onChange={(event) => setAmount(event.target.value)} required />
        </div>
        <div>
          <label htmlFor="fee">Tarifa cobrada na origem (R$)</label>
          <input id="fee" name="fee" type="text" inputMode="decimal" placeholder="0,00" value={fee} onChange={(event) => setFee(event.target.value)} />
        </div>
        <div>
          <label htmlFor="transferDate">Data da transferência</label>
          <input id="transferDate" name="transferDate" type="date" defaultValue={today} required />
        </div>
        <div>
          <label htmlFor="description">Descrição (opcional)</label>
          <input id="description" name="description" type="text" maxLength={500} placeholder="Ex.: Reserva para impostos" />
        </div>
      </div>

      <div className="transfer-preview" aria-live="polite">
        {ready ? (
          <>
            <strong>Antes de confirmar</strong>
            <span>{from?.name}: saída de {formatCents(BigInt(amountCents + feeCents))}</span>
            <span>{to?.name}: entrada de {formatCents(BigInt(amountCents))}</span>
            <small>{feeCents > 0 ? `A diferença de ${formatCents(BigInt(feeCents))} é a tarifa.` : "Sem tarifa. O saldo total da empresa não muda."}</small>
          </>
        ) : (
          <p>{amountParsed === null || feeParsed === null ? "Informe valores válidos com até duas casas decimais." : "Selecione duas contas diferentes e informe o valor para revisar o efeito nos saldos."}</p>
        )}
      </div>
      <div className="record-detail-inline-actions">
        <SubmitButton disabled={!ready}>Confirmar transferência</SubmitButton>
        <Link href="/transferencias" className="button-link">Cancelar</Link>
      </div>
    </form>
  );
}
