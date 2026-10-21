"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  ArrowRight,
  CircleNotch,
  EnvelopeSimple,
  Eye,
  EyeSlash,
  LockSimple,
  Wallet,
} from "@/components/ui/animated-icons";
import styles from "./login.module.css";

type LoginExperienceProps = {
  action: (formData: FormData) => Promise<void>;
  errorMessage?: string;
  registrationCompleted: boolean;
  returnTo?: string;
  verificationRequired: boolean;
  previewLink?: string;
  emailVerified: boolean;
  passwordReset: boolean;
};

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

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button className={styles.primaryButton} type="submit" disabled={pending} aria-busy={pending || undefined}>
      {pending ? (
        <>
          <CircleNotch className={styles.spinner} size={20} aria-hidden="true" />
          Entrando…
        </>
      ) : (
        <>
          Entrar
          <ArrowRight size={20} aria-hidden="true" />
        </>
      )}
    </button>
  );
}

function Ledger() {
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

export function LoginExperience({
  action,
  errorMessage,
  registrationCompleted,
  returnTo,
  verificationRequired,
  previewLink,
  emailVerified,
  passwordReset,
}: LoginExperienceProps) {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const registerHref = returnTo ? `/registro?retorno=${encodeURIComponent(returnTo)}` : "/registro";

  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <Link href="/" className={styles.brand} aria-label="AX Finance, página inicial">
          <span className={styles.brandMark} aria-hidden="true"><Wallet size={18} /></span>
          AX Finance
        </Link>
      </header>

      <main className={styles.layout}>
        <section className={styles.story} aria-labelledby="login-story">
          <h1 id="login-story">Saiba quanto tem e o que vem pela frente.</h1>
          <p className={styles.lede}>Entradas, saídas e contas no mesmo extrato. O saldo de hoje e a previsão das próximas semanas se explicam linha a linha.</p>
          <Ledger />
        </section>

        <section className={styles.formCard} aria-labelledby="login-title">
          <header className={styles.formHeader}>
            <h2 id="login-title">Entrar</h2>
            <p>Acesse sua empresa ou as finanças da casa.</p>
          </header>

          {registrationCompleted && (
            <p className={`${styles.status} ${styles.success}`} role="status">
              Enviamos um e-mail para você. Siga as instruções da mensagem para ativar sua conta e entrar. <Link href="/verificar-email">Reenviar confirmação</Link>
            </p>
          )}

          {verificationRequired && !registrationCompleted && (
            <p className={`${styles.status} ${styles.error}`} role="status">
              Confirme seu e-mail antes de entrar. <Link href="/verificar-email">Reenviar confirmação</Link>
            </p>
          )}

          {previewLink && (
            <p className={`${styles.status} ${styles.success}`} role="status">
              Ambiente local: <Link href={previewLink}>abrir link de verificação</Link>.
            </p>
          )}

          {emailVerified && (
            <p className={`${styles.status} ${styles.success}`} role="status">
              E-mail confirmado. Você já pode entrar.
            </p>
          )}

          {passwordReset && (
            <p className={`${styles.status} ${styles.success}`} role="status">
              Senha redefinida. Entre novamente com a nova senha.
            </p>
          )}

          {errorMessage && (
            <p className={`${styles.status} ${styles.error}`} role="alert">
              {errorMessage}
            </p>
          )}

          <form action={action} className={styles.form}>
            {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
            <div className={styles.field}>
              <label htmlFor="email">E-mail</label>
              <div className={styles.inputWrap}>
                <EnvelopeSimple size={18} aria-hidden="true" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="voce@exemplo.com"
                  required
                  maxLength={254}
                />
              </div>
            </div>

            <div className={styles.field}>
              <div className={styles.labelRow}>
                <label htmlFor="password">Senha</label>
                <Link className={styles.textLink} href="/recuperar-senha">Esqueci minha senha</Link>
              </div>
              <div className={styles.inputWrap}>
                <LockSimple size={18} aria-hidden="true" />
                <input
                  id="password"
                  name="password"
                  type={passwordVisible ? "text" : "password"}
                  autoComplete="current-password"
                  required
                />
                <button
                  className={styles.eyeButton}
                  type="button"
                  aria-label={passwordVisible ? "Ocultar senha" : "Mostrar senha"}
                  aria-pressed={passwordVisible}
                  onClick={() => setPasswordVisible((visible) => !visible)}
                >
                  {passwordVisible ? <EyeSlash size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <label className={styles.checkbox}>
              <input type="checkbox" name="remember" />
              <span>Manter conectado neste computador</span>
            </label>

            <SubmitButton />
          </form>

          <p className={styles.register}>
            Ainda não usa o AX Finance? <Link href={registerHref}>Teste 14 dias grátis</Link>
          </p>
        </section>
      </main>

      <footer className={styles.footer}>
        <p>AX Finance · gestão financeira para empresa e casa</p>
        <nav aria-label="Informações legais">
          <Link href="/privacidade">Privacidade</Link>
          <Link href="/termos">Termos de uso</Link>
        </nav>
      </footer>
    </div>
  );
}
