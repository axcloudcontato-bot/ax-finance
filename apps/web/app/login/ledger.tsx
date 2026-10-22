"use client";

import { useEffect, useState } from "react";
import styles from "./login.module.css";

/** Extrato de exemplo (fictício): mostra o que o produto faz — o saldo corrente fecha linha a linha. */
const OPENING_CENTS = 350_000;
const MOVEMENTS = [
  { date: "18/10", description: "Venda de serviço", cents: 120_000 },
  { date: "19/10", description: "Aluguel da sala", cents: -150_000 },
  { date: "20/10", description: "Instalação", cents: 80_000 },
  { date: "21/10", description: "Conta de luz", cents: -21_000 },
];
const ROWS = MOVEMENTS.reduce<{ date: string; description: string; cents: number; balance: number }[]>((rows, movement) => {
  const previous = rows.length ? rows[rows.length - 1]!.balance : OPENING_CENTS;
  rows.push({ ...movement, balance: previous + movement.cents });
  return rows;
}, []);
const CLOSING_CENTS = ROWS[ROWS.length - 1]!.balance;

const brl = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = (cents: number) => brl.format(cents / 100);
const signed = (cents: number) => `${cents < 0 ? "−" : "+"} ${money(Math.abs(cents))}`;

const STEP_MS = 420;

/**
 * O saldo soma uma vez ao abrir: cada linha acende na sua vez e o "Saldo de hoje" corre do saldo
 * inicial até o fechamento. Com movimento reduzido (ou antes de hidratar), tudo já aparece pronto.
 */
function useLedgerTally() {
  const [step, setStep] = useState(ROWS.length);
  const [closing, setClosing] = useState(CLOSING_CENTS);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setStep(0);
    setClosing(OPENING_CENTS);
    const timers = ROWS.map((row, index) => window.setTimeout(() => setStep(index + 1), 260 + index * STEP_MS));
    const start = performance.now() + 260;
    const duration = ROWS.length * STEP_MS;
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, Math.max(0, (now - start) / duration));
      const eased = 1 - Math.pow(1 - progress, 3);
      setClosing(Math.round(OPENING_CENTS + (CLOSING_CENTS - OPENING_CENTS) * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => { timers.forEach(window.clearTimeout); cancelAnimationFrame(frame); };
  }, []);

  return { step, closing };
}

export function Ledger() {
  const { step, closing } = useLedgerTally();

  return (
    <figure className={styles.ledger} aria-labelledby="ledger-caption">
      <figcaption id="ledger-caption" className={styles.ledgerCaption}>
        <span>Extrato da conta</span>
        <span className={styles.sampleTag}>Exemplo</span>
      </figcaption>
      <table className={styles.ledgerTable}>
        <thead>
          <tr>
            <th scope="col">Data</th>
            <th scope="col">Descrição</th>
            <th scope="col" className={styles.num}>Valor</th>
            <th scope="col" className={styles.num}>Saldo</th>
          </tr>
        </thead>
        <tbody>
          <tr className={styles.opening}>
            <td>17/10</td>
            <td>Saldo inicial</td>
            <td className={styles.num} />
            <td className={styles.num}>{money(OPENING_CENTS)}</td>
          </tr>
          {ROWS.map((row, index) => (
            <tr key={row.date} className={styles.movement} data-lit={index < step || undefined}>
              <td>{row.date}</td>
              <td>{row.description}</td>
              <td className={`${styles.num} ${row.cents < 0 ? styles.out : styles.in}`}>{signed(row.cents)}</td>
              <td className={styles.num}>{money(row.balance)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className={styles.closing}>
        <span>Saldo de hoje</span>
        <strong>
          <span aria-hidden="true">R$ {money(closing)}</span>
          <span className={styles.srOnly}>R$ {money(CLOSING_CENTS)}</span>
        </strong>
      </div>
    </figure>
  );
}
